import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { PeerToPeerBetting } from "../target/types/peer_to_peer_betting";
import { assert } from "chai";

describe("peer_to_peer_betting", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.peer_to_peer_betting as Program<PeerToPeerBetting>;
  const connection = anchor.getProvider().connection;

  const maker = Keypair.generate();
  const taker = Keypair.generate();
  const judge = Keypair.generate();

  const bet = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bet"),
      maker.publicKey.toBuffer(),
      taker.publicKey.toBuffer(),
      judge.publicKey.toBuffer(),
      Buffer.from("test"), // description: test
    ],
    program.programId
  )[0];

  const vault = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      bet.toBuffer(),
    ],
    program.programId
  )[0];

  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  it("airdrop", async () => {
    await connection
      .requestAirdrop(maker.publicKey, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);

    await connection
      .requestAirdrop(taker.publicKey, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);
  });

  it("maker can create bet", async () => {
    const tx = await program.methods
    .make("test", new anchor.BN(1e9))
    .accounts({
      maker: maker.publicKey,
      opponent: taker.publicKey,
      judge: judge.publicKey,
      bet,
      vault,
      systemProgram: SystemProgram.programId
    })
    .signers([maker])
    .rpc()
    .then(confirm)
    .then(log)

    // assert the bet vault has 1 sol deposited from the maker
    const vaultBalance = await connection.getBalance(vault);
    assert.equal(vaultBalance, 1e9);
  });

  xit("maker can cancel a bet", async () => {
    const tx = await program.methods
    .cancel()
    .accounts({
      maker: maker.publicKey,
      opponent: taker.publicKey,
      judge: judge.publicKey,
      bet,
      vault,
      systemProgram: SystemProgram.programId
    })
    .signers([maker])
    .rpc()
    .then(confirm)
    .then(log)

    // assert maker has gotten the 1 sol back
    const makerBalance = await connection.getBalance(maker.publicKey);
    assert.equal(makerBalance, LAMPORTS_PER_SOL * 10);
  });

  it("opponent can take bet", async () => {
    // const vaultBalanceBefore = await connection.getBalance(vault);
    // console.log("Vault balance before: " + vaultBalanceBefore);

    const tx = await program.methods
    .take()
    .accounts({
      opponent: taker.publicKey,
      maker: maker.publicKey,
      judge: judge.publicKey,
      bet,
      vault,
      systemProgram: SystemProgram.programId
    })
    .signers([taker])
    .rpc()
    .then(confirm)
    .then(log)

    // assert vault has 2 * bet amount balance
    const vaultBalance = await connection.getBalance(vault);
    assert.equal(vaultBalance, LAMPORTS_PER_SOL * 2);
  });

});

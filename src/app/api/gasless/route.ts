import { Account, Call, constants, RpcProvider } from "starknet";
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { toBeHex } from "ethers";
import {
  fetchBuildTypedData,
  fetchExecuteTransaction,
  SEPOLIA_BASE_URL,
} from "@avnu/gasless-sdk";

export async function GET(req: Request) {
  const provider = new RpcProvider({
    nodeUrl: constants.NetworkName.SN_SEPOLIA,
  });
  const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY!;
  const operatorAddress = process.env.OPERATOR_ADDRESS!;

  const operatorAccount = new Account(
    provider,
    operatorAddress,
    operatorPrivateKey,
  );

  const initialValue: Call[] = [
    {
      entrypoint: "transfer",
      contractAddress:
        "0x377cb6eef0939f403f7db43150a4c5832aec8d5f490b1543d0c2f3b92e58e73",
      calldata: [
        "0x2cc5a608e8c9c210fbcff7556e621d3e6c8a3f3b6cc200bb33cabaa15573a6d", // recipient
        "0x1", // high
        "0x0", // low
      ],
    },
  ];

  const typedData = await fetchBuildTypedData(
    operatorAccount.address,
    initialValue,
    undefined,
    undefined,
    {
      apiKey: process.env.ANVU_API_KEY!,
      baseUrl: SEPOLIA_BASE_URL,
    },
  );

  let signature = await operatorAccount.signMessage(typedData);

  if (Array.isArray(signature)) {
    signature = signature.map((sig) => toBeHex(BigInt(sig)));
  } else if (signature.r && signature.s) {
    signature = [toBeHex(BigInt(signature.r)), toBeHex(BigInt(signature.s))];
  }

  try {
    const executeData = await fetchExecuteTransaction(
      operatorAccount.address,
      JSON.stringify(typedData),
      signature,
      {
        apiKey: process.env.ANVU_API_KEY!,
        baseUrl: SEPOLIA_BASE_URL,
      },
    );

    return NextResponse.json(
      { executeData, signature },
      {
        status: StatusCodes.OK,
      },
    );
  } catch (e) {
    console.log(`🚨 Gasless errror:`,e);
    return NextResponse.json(
      //@ts-ignore
      { error: e.message },
      {
        status: StatusCodes.BAD_REQUEST,
      },
    );
  }
}

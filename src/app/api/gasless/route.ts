import { Account, Call, RpcProvider } from "starknet";
import { NextResponse } from "next/server";
import { StatusCodes } from "http-status-codes";
import { toBeHex } from "ethers";
import {
  fetchBuildTypedData,
  fetchExecuteTransaction,
  SEPOLIA_BASE_URL,
} from "@avnu/gasless-sdk";

export async function POST(req: Request) {
  const provider = new RpcProvider({
    nodeUrl: `https://starknet-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`, // sepolia
  });
  const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY!;
  const operatorPublicKey = process.env.OPERATOR_PUBLIC_KEY!;

  const operatorAccount = new Account(
    provider,
    operatorPublicKey,
    operatorPrivateKey,
  );

  const initialValue: Call[] = [
    {
      entrypoint: "approve",
      contractAddress:
        "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", // ETH
      calldata: [
        "0x03dc2f3741106ec05307963159bfcff41e661722bc9349f9dc565f2540df9561", // spender
        "0x0", // 0
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

  // 1️⃣ Fetch execute by API
  const executeResponse = await fetch(
    `${SEPOLIA_BASE_URL}/paymaster/v1/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.ANVU_API_KEY!,
      },
      body: JSON.stringify({
        signature,
        typedData,
        userAddress: operatorAccount.address,
      }),
    },
  );
  console.log(executeResponse);
  const executeData = await executeResponse.json();

  // ❌❌RESPONSE❌❌
  // Response {
  //   status: 400,
  //       statusText: 'Bad Request',
  //       headers: Headers {
  //     date: 'Fri, 16 Aug 2024 08:23:31 GMT',
  //         'content-type': 'application/json',
  //         'content-length': '140',
  //         connection: 'keep-alive',
  //         vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
  //   },
  //   body: ReadableStream { locked: false, state: 'readable', supportsBYOB: true },
  //   bodyUsed: false,
  //       ok: false,
  //       redirected: false,
  //       type: 'basic',
  //       url: 'https://sepolia.api.avnu.fi/paymaster/v1/execute'
  // }

  // 2️⃣ fetchExecuteTransaction

  // const executeData = await fetchExecuteTransaction(
  //   operatorAccount.address,
  //   JSON.stringify(typedData),
  //   signature,
  //   {
  //     apiKey: process.env.ANVU_API_KEY!,
  //     baseUrl: SEPOLIA_BASE_URL,
  //   },
  // );

  // // ❌❌Error❌❌: 500 Internal Server Error
  // at parseResponse (webpack-internal:///(rsc)/./node_modules/@avnu/gasless-sdk/dist/index.mjs:71:11)

  return NextResponse.json(
    { executeData, signature },
    {
      status: StatusCodes.OK,
    },
  );
}

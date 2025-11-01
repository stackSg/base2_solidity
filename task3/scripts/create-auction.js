const hre = require("hardhat");

/**
 * 创建拍卖示例脚本
 * 使用方法: npx hardhat run scripts/create-auction.js --network <network>
 * 
 * 需要设置环境变量:
 * - FACTORY_ADDRESS: 工厂合约地址
 * - NFT_ADDRESS: NFT合约地址
 * - TOKEN_ID: NFT的tokenId
 */
async function main() {
  const [seller] = await hre.ethers.getSigners();
  console.log("创建拍卖，卖家:", seller.address);

  // 从环境变量或命令行参数获取地址
  const factoryAddress = process.env.FACTORY_ADDRESS || "0x...";
  const nftAddress = process.env.NFT_ADDRESS || "0x...";
  const tokenId = process.env.TOKEN_ID || "1";
  const acceptedToken = process.env.ACCEPTED_TOKEN || ethers.ZeroAddress; // 0x0 for ETH
  const minBid = process.env.MIN_BID || ethers.parseEther("0.1");

  // 获取合约实例
  const factory = await hre.ethers.getContractAt("AuctionFactory", factoryAddress);
  const nft = await hre.ethers.getContractAt("NFTMarketplace", nftAddress);

  // 检查NFT所有者
  const owner = await nft.ownerOf(tokenId);
  if (owner.toLowerCase() !== seller.address.toLowerCase()) {
    throw new Error(`NFT不属于卖家。所有者: ${owner}`);
  }

  // 批准NFT转移
  console.log("批准NFT转移...");
  const approveTx = await nft.approve(factoryAddress, tokenId);
  await approveTx.wait();
  console.log("NFT已批准");

  // 设置拍卖时间
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1分钟后开始
  const endTime = startTime + 3600; // 1小时后结束

  console.log("\n创建拍卖...");
  console.log("NFT地址:", nftAddress);
  console.log("Token ID:", tokenId);
  console.log("接受的代币:", acceptedToken === ethers.ZeroAddress ? "ETH" : acceptedToken);
  console.log("最小出价:", hre.ethers.formatEther(minBid));
  console.log("开始时间:", new Date(startTime * 1000).toLocaleString());
  console.log("结束时间:", new Date(endTime * 1000).toLocaleString());

  const createTx = await factory.createAuction(
    nftAddress,
    tokenId,
    acceptedToken,
    startTime,
    endTime,
    minBid
  );

  const receipt = await createTx.wait();
  console.log("交易哈希:", receipt.hash);

  // 解析事件
  const auctionCreatedEvent = receipt.logs.find(
    log => {
      try {
        return factory.interface.parseLog(log).name === "AuctionCreated";
      } catch {
        return false;
      }
    }
  );

  if (auctionCreatedEvent) {
    const decoded = factory.interface.parseLog(auctionCreatedEvent);
    const auctionAddress = decoded.args.auctionAddress;
    console.log("\n========== 拍卖创建成功 ==========");
    console.log("拍卖合约地址:", auctionAddress);
    console.log("卖家:", decoded.args.seller);
    console.log("NFT合约:", decoded.args.nftContract);
    console.log("Token ID:", decoded.args.tokenId.toString());
    console.log("===================================\n");
  } else {
    console.log("未找到AuctionCreated事件");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

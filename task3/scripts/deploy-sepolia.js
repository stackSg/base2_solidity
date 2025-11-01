const hre = require("hardhat");
const { upgrades } = require("hardhat");

/**
 * Sepolia测试网部署脚本
 * 使用前请确保：
 * 1. 设置了SEPOLIA_URL环境变量
 * 2. 设置了PRIVATE_KEY环境变量
 * 3. 账户有足够的ETH支付gas费
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署到Sepolia测试网");
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Chainlink Sepolia价格聚合器地址
  const SEPOLIA_ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  const SEPOLIA_LINK_USD = "0xc59E3633BAAC79493d08e6B77840f61Fa08e3867";

  // 1. 部署NFT合约
  console.log("\n1. 部署NFT合约...");
  const NFTMarketplace = await hre.ethers.getContractFactory("NFTMarketplace");
  const nftMarketplace = await NFTMarketplace.deploy(
    "NFT Marketplace",
    "NFTM",
    "https://api.example.com/token/"
  );
  await nftMarketplace.waitForDeployment();
  const nftAddress = await nftMarketplace.getAddress();
  console.log("NFT合约地址:", nftAddress);

  // 等待确认
  await nftMarketplace.waitForDeployment();

  // 2. 部署价格预言机
  console.log("\n2. 部署价格预言机...");
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await upgrades.deployProxy(
    PriceOracle,
    [SEPOLIA_ETH_USD],
    { initializer: "initialize" }
  );
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("价格预言机地址:", priceOracleAddress);

  // 配置LINK代币价格
  console.log("\n配置LINK代币价格...");
  await priceOracle.setTokenPriceFeed(
    "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK on Sepolia
    SEPOLIA_LINK_USD
  );

  // 3. 部署拍卖实现合约
  console.log("\n3. 部署拍卖实现合约...");
  const Auction = await hre.ethers.getContractFactory("Auction");
  const auctionImplementation = await Auction.deploy();
  await auctionImplementation.waitForDeployment();
  const auctionImplAddress = await auctionImplementation.getAddress();
  console.log("拍卖实现合约地址:", auctionImplAddress);

  // 4. 部署工厂合约
  console.log("\n4. 部署工厂合约...");
  const AuctionFactory = await hre.ethers.getContractFactory("AuctionFactory");
  const factory = await upgrades.deployProxy(
    AuctionFactory,
    [auctionImplAddress, priceOracleAddress],
    { initializer: "initialize" }
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("工厂合约地址:", factoryAddress);

  // 等待所有交易确认
  console.log("\n等待交易确认...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  console.log("\n========== 部署完成 ==========");
  console.log("NFT合约:", nftAddress);
  console.log("价格预言机:", priceOracleAddress);
  console.log("拍卖实现合约:", auctionImplAddress);
  console.log("工厂合约:", factoryAddress);
  console.log("=============================\n");

  console.log("请保存以上地址，用于后续交互");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

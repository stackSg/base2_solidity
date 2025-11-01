const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署合约，账户:", deployer.address);
  console.log("账户余额:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

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

  // 2. 部署价格预言机
  console.log("\n2. 部署价格预言机...");
  let ethUsdPriceFeed;
  
  // 根据网络选择Chainlink价格聚合器地址
  const network = await hre.network.name;
  if (network === "sepolia") {
    ethUsdPriceFeed = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // ETH/USD Sepolia
  } else if (network === "goerli") {
    ethUsdPriceFeed = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"; // ETH/USD Goerli
  } else {
    // 本地测试或hardhat网络，部署Mock价格聚合器
    console.log("部署Mock价格聚合器...");
    const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await MockPriceFeed.deploy();
    await mockPriceFeed.waitForDeployment();
    await mockPriceFeed.setPrice(3000 * 10 ** 8); // $3000
    ethUsdPriceFeed = await mockPriceFeed.getAddress();
    console.log("Mock价格聚合器地址:", ethUsdPriceFeed);
  }

  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await upgrades.deployProxy(
    PriceOracle,
    [ethUsdPriceFeed],
    { initializer: "initialize" }
  );
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("价格预言机地址:", priceOracleAddress);

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

  // 5. 部署ERC20代币（用于测试）
  console.log("\n5. 部署测试ERC20代币...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockERC20 = await MockERC20.deploy("Test Token", "TT");
  await mockERC20.waitForDeployment();
  const mockERC20Address = await mockERC20.getAddress();
  console.log("测试ERC20代币地址:", mockERC20Address);

  // 6. 配置ERC20代币价格（如果在本地网络）
  if (network === "hardhat" || network === "localhost") {
    console.log("\n6. 配置ERC20代币价格...");
    const MockPriceFeed = await hre.ethers.getContractFactory("MockPriceFeed");
    const tokenPriceFeed = await MockPriceFeed.deploy();
    await tokenPriceFeed.waitForDeployment();
    await tokenPriceFeed.setPrice(2 * 10 ** 8); // $2 per token
    await priceOracle.setTokenPriceFeed(mockERC20Address, await tokenPriceFeed.getAddress());
    console.log("ERC20价格聚合器地址:", await tokenPriceFeed.getAddress());
  }

  // 输出部署摘要
  console.log("\n========== 部署摘要 ==========");
  console.log("网络:", network);
  console.log("NFT合约:", nftAddress);
  console.log("价格预言机:", priceOracleAddress);
  console.log("拍卖实现合约:", auctionImplAddress);
  console.log("工厂合约:", factoryAddress);
  console.log("测试ERC20代币:", mockERC20Address);
  console.log("=============================\n");

  // 保存部署地址（可选）
  const deploymentInfo = {
    network: network,
    contracts: {
      NFTMarketplace: nftAddress,
      PriceOracle: priceOracleAddress,
      AuctionImplementation: auctionImplAddress,
      AuctionFactory: factoryAddress,
      MockERC20: mockERC20Address,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("部署信息:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

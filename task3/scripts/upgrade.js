const hre = require("hardhat");
const { upgrades } = require("hardhat");

/**
 * 合约升级脚本
 * 使用方法: 
 * npx hardhat run scripts/upgrade.js --network <network>
 * 
 * 需要设置环境变量:
 * - PROXY_ADDRESS: 代理合约地址（工厂或价格预言机）
 * - CONTRACT_NAME: 要升级的合约名称（AuctionFactory 或 PriceOracle）
 */
async function main() {
  const contractName = process.env.CONTRACT_NAME || "AuctionFactory";
  const proxyAddress = process.env.PROXY_ADDRESS;

  if (!proxyAddress) {
    throw new Error("请设置PROXY_ADDRESS环境变量");
  }

  console.log(`升级 ${contractName} 合约`);
  console.log("代理地址:", proxyAddress);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  
  console.log("部署新实现合约...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("\n========== 升级完成 ==========");
  console.log("代理地址:", proxyAddress);
  console.log("新实现地址:", implementationAddress);
  console.log("=============================\n");

  // 验证升级（如果在支持的网络上）
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("等待区块确认以进行验证...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await hre.run("verify:verify", {
        address: implementationAddress,
      });
      console.log("合约验证成功");
    } catch (error) {
      console.log("合约验证失败（可能已验证）:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

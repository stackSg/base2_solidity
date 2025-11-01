# NFT 拍卖市场

一个功能完整的 NFT 拍卖市场系统，支持使用 ETH 或 ERC20 代币进行出价，集成 Chainlink 价格预言机和跨链功能。

## 功能特性

### 核心功能
- ✅ **ERC721 NFT 合约**: 支持 NFT 铸造和转移
- ✅ **拍卖合约**: 支持 ETH 和 ERC20 代币出价
- ✅ **工厂模式**: 类似 Uniswap V2 的工厂模式管理拍卖实例
- ✅ **价格预言机**: 使用 Chainlink 获取 ERC20 和 ETH 到美元的价格
- ✅ **合约升级**: 使用 UUPS 代理模式支持安全升级
- ✅ **跨链拍卖**: 使用 Chainlink CCIP 支持跨链拍卖（基础实现）

### 技术特性
- **可升级合约**: 使用 UUPS 代理模式，支持合约升级
- **价格比较**: 通过 Chainlink 价格预言机，自动将不同代币的出价转换为美元进行比较
- **工厂模式**: 统一的工厂合约管理所有拍卖实例
- **安全特性**: 使用 OpenZeppelin 的 ReentrancyGuard 防止重入攻击

## 项目结构

```
task3/
├── contracts/
│   ├── NFTMarketplace.sol      # ERC721 NFT合约
│   ├── Auction.sol             # 拍卖合约（UUPS可升级）
│   ├── AuctionFactory.sol      # 工厂合约（UUPS可升级）
│   ├── PriceOracle.sol         # 价格预言机合约（UUPS可升级）
│   ├── CrossChainAuction.sol   # 跨链拍卖合约
│   ├── MockERC20.sol           # 测试用ERC20代币
│   └── MockPriceFeed.sol       # 测试用价格聚合器
├── test/
│   ├── NFTMarketplace.test.js  # NFT合约测试
│   ├── PriceOracle.test.js     # 价格预言机测试
│   ├── Auction.test.js         # 拍卖合约测试
│   └── AuctionFactory.test.js  # 工厂合约测试
├── scripts/
│   ├── deploy.js               # 本地部署脚本
│   ├── deploy-sepolia.js       # Sepolia测试网部署脚本
│   ├── create-auction.js       # 创建拍卖示例脚本
│   └── upgrade.js              # 合约升级脚本
├── hardhat.config.js           # Hardhat配置
└── package.json                # 项目依赖

```

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npm run compile
# 或
npx hardhat compile
```

### 运行测试

```bash
npm test
# 或带gas报告
npm run test:gas
```

### 本地部署

1. 启动本地节点：
```bash
npm run node
```

2. 在另一个终端部署合约：
```bash
npm run deploy:local
```

## 部署到测试网

### Sepolia 测试网

1. 配置环境变量（创建 `.env` 文件）：
```env
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_private_key_here
```

2. 部署：
```bash
npm run deploy:sepolia
```

### 其他测试网

修改 `hardhat.config.js` 中的网络配置，然后运行：
```bash
npx hardhat run scripts/deploy.js --network <network_name>
```

## 使用示例

### 1. 创建拍卖

```javascript
const factory = await ethers.getContractAt("AuctionFactory", factoryAddress);
const nft = await ethers.getContractAt("NFTMarketplace", nftAddress);

// 批准NFT转移
await nft.approve(factoryAddress, tokenId);

// 创建拍卖（接受ETH）
const startTime = Math.floor(Date.now() / 1000) + 60;
const endTime = startTime + 3600;
const tx = await factory.createAuction(
  nftAddress,
  tokenId,
  ethers.ZeroAddress, // ETH
  startTime,
  endTime,
  ethers.parseEther("0.1") // 最小出价
);
```

### 2. 使用ETH出价

```javascript
const auction = await ethers.getContractAt("Auction", auctionAddress);
await auction.bidEth({ value: ethers.parseEther("1") });
```

### 3. 使用ERC20出价

```javascript
const auction = await ethers.getContractAt("Auction", auctionAddress);
const token = await ethers.getContractAt("MockERC20", tokenAddress);

// 批准代币
await token.approve(auctionAddress, ethers.parseEther("1000"));

// 出价
await auction.bidToken(ethers.parseEther("1000"));
```

### 4. 结束拍卖

```javascript
await auction.endAuction();
```

## 合约说明

### NFTMarketplace (ERC721)
- `mint(address to)`: 铸造NFT给指定地址
- `mintBatch(address to, uint256 amount)`: 批量铸造NFT
- 标准 ERC721 转移功能

### Auction
- `initialize(...)`: 初始化拍卖
- `bidEth()`: 使用ETH出价
- `bidToken(uint256 amount)`: 使用ERC20代币出价
- `endAuction()`: 结束拍卖
- `withdraw()`: 撤回未中标的ETH出价
- `withdrawToken(address token)`: 撤回未中标的ERC20出价
- `cancelAuction()`: 取消拍卖（仅卖家）

### AuctionFactory
- `createAuction(...)`: 创建新的拍卖
- `getAuctionCount()`: 获取拍卖总数
- `getAuctionsBySeller(address)`: 获取卖家的所有拍卖
- `getAllAuctions()`: 获取所有拍卖地址

### PriceOracle
- `getEthPrice()`: 获取ETH的美元价格
- `getTokenPrice(address)`: 获取ERC20代币的美元价格
- `convertEthToUsd(uint256)`: 将ETH转换为美元
- `convertTokenToUsd(address, uint256)`: 将ERC20转换为美元
- `compareBids(...)`: 比较两个出价的美元价值

## Chainlink 集成

### 价格预言机

项目使用 Chainlink 价格聚合器获取实时价格：

- **ETH/USD**: 
  - Sepolia: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
  - Goerli: `0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e`

- **添加其他代币价格**:
```javascript
await priceOracle.setTokenPriceFeed(tokenAddress, priceFeedAddress);
```

### 跨链功能

`CrossChainAuction` 合约支持跨链拍卖，使用 Chainlink CCIP。注意：
- 需要配置 CCIP Router 地址
- 需要目标链的链选择器
- 实际部署时需要测试网 LINK 代币支付跨链费用

## 合约升级

所有核心合约（AuctionFactory, PriceOracle, Auction）都支持 UUPS 升级模式。

### 升级合约

```bash
# 设置环境变量
export PROXY_ADDRESS=0x...
export CONTRACT_NAME=AuctionFactory

# 执行升级
npx hardhat run scripts/upgrade.js --network sepolia
```

### 升级流程

1. 修改合约代码（保持存储布局不变）
2. 重新编译合约
3. 运行升级脚本
4. 验证新实现地址

## 测试

项目包含完整的测试套件：

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npx hardhat test test/Auction.test.js

# 带gas报告
REPORT_GAS=true npx hardhat test
```

### 测试覆盖率

```bash
npx hardhat coverage
```

## 安全注意事项

1. **重入攻击防护**: 所有关键函数使用 `ReentrancyGuard`
2. **溢出保护**: 使用 Solidity 0.8+ 内置的溢出检查
3. **访问控制**: 使用 OpenZeppelin 的 `Ownable` 进行权限管理
4. **代理升级**: 使用 UUPS 模式，升级权限仅授予所有者
5. **价格预言机**: 使用 Chainlink 的可靠价格源

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请提交 Issue。

---

**注意**: 这是一个教育项目。在生产环境使用前，请进行充分的安全审计和测试。
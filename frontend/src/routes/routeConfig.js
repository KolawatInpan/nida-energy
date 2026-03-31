import { Security, Parking, Utility, Environment, Analytic, Smoke, Covid } from "../pages/legacy";
import { LoginPage } from "../pages/auth";
import { Users, Buildings, Meters, Quota, ApprovedRequest, RegisterRequestDetail, AdminResetDatabase, TokenManagement, RateManagement } from "../pages/admin";
import { Building, Meter, MeterRegistration, Report } from "../pages/energy";
import { Transaction, TradingHistory, TransactionDetail } from "../pages/transactions";
import { Wallet, Receipts, ReceiptDetail, Invoice, InvoicePayment } from "../pages/billing";
import { EnergySelling, Market, MockEnergy } from "../pages/trading";
import { BlockExplorer, BlockExplorerTransactionDetail, BlockchainValidators, TransactionBlockchainCompare } from "../pages/blockchain";
import { ROUTE_PATHS } from "./routePaths";

export const publicRoutes = [
  { path: ROUTE_PATHS.login, exact: true, component: LoginPage },
  { path: ROUTE_PATHS.meterRegistration, exact: true, component: MeterRegistration },
  { path: ROUTE_PATHS.root, exact: true, component: LoginPage },
];

export const authenticatedRoutes = [
  { path: ROUTE_PATHS.security, exact: true, component: Security },
  { path: ROUTE_PATHS.parking, exact: true, component: Parking },
  { path: ROUTE_PATHS.utility, exact: true, component: Utility },
  { path: ROUTE_PATHS.environment, exact: true, component: Environment },
  { path: ROUTE_PATHS.analytic, exact: true, component: Analytic },
  { path: ROUTE_PATHS.covid, exact: true, component: Covid },
  { path: ROUTE_PATHS.smoke, exact: true, component: Smoke },
  { path: ROUTE_PATHS.adminUsers, exact: true, component: Users, adminOnly: true },
  { path: ROUTE_PATHS.adminBuildings, exact: true, component: Buildings, adminOnly: true },
  { path: ROUTE_PATHS.adminMeters, exact: true, component: Meters, adminOnly: true },
  { path: ROUTE_PATHS.adminResetDatabase, exact: true, component: AdminResetDatabase, adminOnly: true },
  { path: ROUTE_PATHS.transaction, exact: true, component: Transaction },
  { path: ROUTE_PATHS.tradingHistory, exact: true, component: TradingHistory },
  { path: ROUTE_PATHS.transactionDetail, exact: true, component: TransactionDetail },
  { path: ROUTE_PATHS.quota, exact: true, component: Quota },
  { path: ROUTE_PATHS.wallet, exact: true, component: Wallet },
  { path: ROUTE_PATHS.walletByBuilding, exact: true, component: Wallet },
  { path: ROUTE_PATHS.building, exact: true, component: Building },
  { path: ROUTE_PATHS.meter, exact: true, component: Meter },
  { path: ROUTE_PATHS.approvedRequest, exact: true, component: ApprovedRequest },
  { path: ROUTE_PATHS.approvedRequestDetail, exact: true, component: RegisterRequestDetail },
  { path: ROUTE_PATHS.meterRegistration, exact: true, component: MeterRegistration },
  { path: ROUTE_PATHS.energySelling, exact: true, component: EnergySelling },
  { path: ROUTE_PATHS.mockEnergy, exact: true, component: MockEnergy },
  { path: ROUTE_PATHS.market, exact: true, component: Market },
  { path: ROUTE_PATHS.blockExplorer, exact: true, component: BlockExplorer },
  { path: ROUTE_PATHS.blockExplorerTx, exact: true, component: BlockExplorerTransactionDetail },
  { path: ROUTE_PATHS.blockchainValidators, exact: true, component: BlockchainValidators },
  { path: ROUTE_PATHS.blockchainCompare, exact: true, component: TransactionBlockchainCompare },
  { path: ROUTE_PATHS.blockchainCompareById, exact: true, component: TransactionBlockchainCompare },
  { path: ROUTE_PATHS.report, exact: true, component: Report },
  { path: ROUTE_PATHS.receipts, exact: true, component: Receipts },
  { path: ROUTE_PATHS.receipt, exact: true, component: ReceiptDetail },
  { path: ROUTE_PATHS.receiptLegacy, exact: true, component: ReceiptDetail },
  { path: ROUTE_PATHS.tokenManagement, exact: true, component: TokenManagement },
  { path: ROUTE_PATHS.invoice, exact: true, component: Invoice },
  { path: ROUTE_PATHS.invoicePayment, exact: true, component: InvoicePayment },
  { path: ROUTE_PATHS.rateManagement, exact: true, component: RateManagement },
];

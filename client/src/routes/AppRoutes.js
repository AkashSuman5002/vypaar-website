import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import LoadingSpinner from '../components/UI/LoadingSpinner';

const LazyLoad = (Component) => (props) => (
  <Suspense fallback={<div className="min-h-screen bg-white dark:bg-[#0F172A] flex items-center justify-center"><LoadingSpinner /></div>}>
    <Component {...props} />
  </Suspense>
);

const Login = LazyLoad(lazy(() => import('../pages/Login')));
const Register = LazyLoad(lazy(() => import('../pages/Register')));
const ForgotPassword = LazyLoad(lazy(() => import('../pages/ForgotPassword')));
const ResetPassword = LazyLoad(lazy(() => import('../pages/ResetPassword')));
const Dashboard = LazyLoad(lazy(() => import('../pages/Dashboard')));
const Customers = LazyLoad(lazy(() => import('../pages/Customers')));
const Products = LazyLoad(lazy(() => import('../pages/Products')));
const Sales = LazyLoad(lazy(() => import('../pages/Sales')));
const QuickInvoice = LazyLoad(lazy(() => import('../pages/QuickInvoice')));
const SaleReturns = LazyLoad(lazy(() => import('../pages/SaleReturns')));
const SaleChallans = LazyLoad(lazy(() => import('../pages/SaleChallans')));
const SaleEstimates = LazyLoad(lazy(() => import('../pages/SaleEstimates')));
const SalePayments = LazyLoad(lazy(() => import('../pages/SalePayments')));
const SaleOrders2 = LazyLoad(lazy(() => import('../pages/SaleOrders2')));
const CreateSale = LazyLoad(lazy(() => import('../pages/CreateSale')));
const ViewSale = LazyLoad(lazy(() => import('../pages/ViewSale')));
const ViewEstimate = LazyLoad(lazy(() => import('../pages/ViewEstimate')));
const ViewProforma = LazyLoad(lazy(() => import('../pages/ViewProforma')));
const ViewOrder = LazyLoad(lazy(() => import('../pages/ViewOrder')));
const ViewChallan = LazyLoad(lazy(() => import('../pages/ViewChallan')));
const ViewReturn = LazyLoad(lazy(() => import('../pages/ViewReturn')));
const EditSale = LazyLoad(lazy(() => import('../pages/EditSale')));
const BankAccounts = LazyLoad(lazy(() => import('../pages/BankAccounts')));
const CashInHand = LazyLoad(lazy(() => import('../pages/CashInHand')));
const Cheques = LazyLoad(lazy(() => import('../pages/Cheques')));
const LoanAccounts = LazyLoad(lazy(() => import('../pages/LoanAccounts')));
const Reports = LazyLoad(lazy(() => import('../pages/Reports')));
const SaleReport = LazyLoad(lazy(() => import('../pages/reports/SaleReport')));
const PurchaseReport = LazyLoad(lazy(() => import('../pages/reports/PurchaseReport')));
const DayBookReport = LazyLoad(lazy(() => import('../pages/reports/DayBookReport')));
const AllTransactionsReport = LazyLoad(lazy(() => import('../pages/reports/AllTransactionsReport')));
const ProfitLossReport = LazyLoad(lazy(() => import('../pages/reports/ProfitLossReport')));
const CashFlowReport = LazyLoad(lazy(() => import('../pages/reports/CashFlowReport')));
const TrialBalanceReport = LazyLoad(lazy(() => import('../pages/reports/TrialBalanceReport')));
const BalanceSheetReport = LazyLoad(lazy(() => import('../pages/reports/BalanceSheetReport')));
const GenericReport = LazyLoad(lazy(() => import('../pages/reports/GenericReport')));
const PartyStatement = LazyLoad(lazy(() => import('../pages/reports/party/PartyStatement')));
const PartyWiseProfitLoss = LazyLoad(lazy(() => import('../pages/reports/party/PartyWiseProfitLoss')));
const AllParties = LazyLoad(lazy(() => import('../pages/reports/party/AllParties')));
const PartyReportByItem = LazyLoad(lazy(() => import('../pages/reports/party/PartyReportByItem')));
const SalePurchaseByParty = LazyLoad(lazy(() => import('../pages/reports/party/SalePurchaseByParty')));
const SalePurchaseByPartyGroup = LazyLoad(lazy(() => import('../pages/reports/party/SalePurchaseByPartyGroup')));
const GSTR1 = LazyLoad(lazy(() => import('../pages/reports/gst/GSTR1')));
const GSTR2 = LazyLoad(lazy(() => import('../pages/reports/gst/GSTR2')));
const GSTR3B = LazyLoad(lazy(() => import('../pages/reports/gst/GSTR3B')));
const GSTR9 = LazyLoad(lazy(() => import('../pages/reports/gst/GSTR9')));
const SaleSummaryByHSN = LazyLoad(lazy(() => import('../pages/reports/gst/SaleSummaryByHSN')));
const SACReport = LazyLoad(lazy(() => import('../pages/reports/gst/SACReport')));
const StockSummary = LazyLoad(lazy(() => import('../pages/reports/stock/StockSummary')));
const ItemReportByParty = LazyLoad(lazy(() => import('../pages/reports/stock/ItemReportByParty')));
const ItemWiseProfitLoss = LazyLoad(lazy(() => import('../pages/reports/stock/ItemWiseProfitLoss')));
const ItemCategoryWiseProfitLoss = LazyLoad(lazy(() => import('../pages/reports/stock/ItemCategoryWiseProfitLoss')));
const LowStockSummary = LazyLoad(lazy(() => import('../pages/reports/stock/LowStockSummary')));
const StockDetail = LazyLoad(lazy(() => import('../pages/reports/stock/StockDetail')));
const StockAging = LazyLoad(lazy(() => import('../pages/reports/stock/StockAging')));
const ItemDetail = LazyLoad(lazy(() => import('../pages/reports/stock/ItemDetail')));
const BusinessStatus = LazyLoad(lazy(() => import('../pages/reports/BusinessStatus')));
const BankStatement = LazyLoad(lazy(() => import('../pages/reports/BankStatement')));
const DiscountReport = LazyLoad(lazy(() => import('../pages/reports/DiscountReport')));
const ExpenseReport = LazyLoad(lazy(() => import('../pages/reports/ExpenseReport')));
const ExpenseCategoryReport = LazyLoad(lazy(() => import('../pages/reports/ExpenseCategoryReport')));
const ExpenseItemReport = LazyLoad(lazy(() => import('../pages/reports/ExpenseItemReport')));
const SaleOrders = LazyLoad(lazy(() => import('../pages/reports/SaleOrders')));
const SaleOrderItem = LazyLoad(lazy(() => import('../pages/reports/SaleOrderItem')));
const LoanStatement = LazyLoad(lazy(() => import('../pages/reports/LoanStatement')));
const GSTReport = LazyLoad(lazy(() => import('../pages/reports/taxes/GSTReport')));
const GSTRateReport = LazyLoad(lazy(() => import('../pages/reports/taxes/GSTRateReport')));
const Form27EQ = LazyLoad(lazy(() => import('../pages/reports/taxes/Form27EQ')));
const TCSReceivable = LazyLoad(lazy(() => import('../pages/reports/taxes/TCSReceivable')));
const PaymentReminder = LazyLoad(lazy(() => import('../pages/reports/PaymentReminder')));
const GSTR2AReconciliation = LazyLoad(lazy(() => import('../pages/reports/gst/GSTR2AReconciliation')));
const TDSPayable = LazyLoad(lazy(() => import('../pages/reports/taxes/TDSPayable')));
const TDSReceivable = LazyLoad(lazy(() => import('../pages/reports/taxes/TDSReceivable')));
const Settings = LazyLoad(lazy(() => import('../pages/Settings')));
const BusinessSetup = LazyLoad(lazy(() => import('../pages/BusinessSetup')));
const EditProfile = LazyLoad(lazy(() => import('../pages/EditProfile')));
const CustomerLedger = LazyLoad(lazy(() => import('../pages/CustomerLedger')));
const SupplierLedger = LazyLoad(lazy(() => import('../pages/SupplierLedger')));
const Suppliers = LazyLoad(lazy(() => import('../pages/Suppliers')));
const PartyDetails = LazyLoad(lazy(() => import('../pages/PartyDetails')));
const WhatsAppConnect = LazyLoad(lazy(() => import('../pages/WhatsAppConnect')));
const BusinessNetwork = LazyLoad(lazy(() => import('../pages/BusinessNetwork')));
const PurchaseBills = LazyLoad(lazy(() => import('../pages/PurchaseBills')));
const CreatePurchaseBill = LazyLoad(lazy(() => import('../pages/CreatePurchaseBill')));
const CreateExpense = LazyLoad(lazy(() => import('../pages/CreateExpense')));
const BarcodeLabelPrint = LazyLoad(lazy(() => import('../pages/BarcodeLabelPrint')));
const PaymentOut = LazyLoad(lazy(() => import('../pages/PaymentOut')));
const Expenses = LazyLoad(lazy(() => import('../pages/Expenses')));
const PurchaseOrder = LazyLoad(lazy(() => import('../pages/PurchaseOrder')));
const CreateDebitNote = LazyLoad(lazy(() => import('../pages/CreateDebitNote')));
const PurchaseReturn = LazyLoad(lazy(() => import('../pages/PurchaseReturn')));
const ImportData = LazyLoad(lazy(() => import('../pages/ImportData')));
const ExportData = LazyLoad(lazy(() => import('../pages/ExportData')));
const ImportFromBarcode = LazyLoad(lazy(() => import('../pages/ImportFromBarcode')));
const PartyToPartyTransfer = LazyLoad(lazy(() => import('../pages/PartyToPartyTransfer')));
const JournalEntry = LazyLoad(lazy(() => import('../pages/JournalEntry')));
const ChartOfAccounts = LazyLoad(lazy(() => import('../pages/ChartOfAccounts')));
const AccountStatements = LazyLoad(lazy(() => import('../pages/AccountStatements')));
const UserManagement = LazyLoad(lazy(() => import('../pages/UserManagement')));
const Support = LazyLoad(lazy(() => import('../pages/Support')));
const Company = LazyLoad(lazy(() => import('../pages/Company')));
const CalendarPage = LazyLoad(lazy(() => import('../pages/CalendarPage')));
const StaffPage = LazyLoad(lazy(() => import('../pages/StaffPage')));

const ImportItems = LazyLoad(lazy(() => import('../pages/utilities/ImportItems')));
const SetupMyBusiness = LazyLoad(lazy(() => import('../pages/utilities/SetupMyBusiness')));
const AccountantAccess = LazyLoad(lazy(() => import('../pages/utilities/AccountantAccess')));
const BarcodeGenerator = LazyLoad(lazy(() => import('../pages/utilities/BarcodeGenerator')));
const UpdateItemsInBulk = LazyLoad(lazy(() => import('../pages/utilities/UpdateItemsInBulk')));
const ImportFromTally = LazyLoad(lazy(() => import('../pages/utilities/ImportFromTally')));
const ImportParties = LazyLoad(lazy(() => import('../pages/utilities/ImportParties')));
const TrackYourSalesmen = LazyLoad(lazy(() => import('../pages/utilities/TrackYourSalesmen')));
const ExportToTally = LazyLoad(lazy(() => import('../pages/utilities/ExportToTally')));
const ExportItemsPage = LazyLoad(lazy(() => import('../pages/utilities/ExportItems')));
const VerifyMyData = LazyLoad(lazy(() => import('../pages/utilities/VerifyMyData')));
const CloseFinancialYear = LazyLoad(lazy(() => import('../pages/utilities/CloseFinancialYear')));

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/parties/details" element={<PartyDetails />} />
        <Route path="/parties/whatsapp" element={<WhatsAppConnect />} />
        <Route path="/parties/network" element={<BusinessNetwork />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id/ledger" element={<CustomerLedger />} />
        <Route path="/products" element={<Products />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/quick" element={<QuickInvoice />} />
        <Route path="/sales/returns" element={<SaleReturns />} />
        <Route path="/sales/returns/:id" element={<ViewReturn />} />
        <Route path="/sales/returns/:id/edit" element={<EditSale />} />
        <Route path="/sales/challans" element={<SaleChallans />} />
        <Route path="/sales/challans/:id" element={<ViewChallan />} />
        <Route path="/sales/challans/:id/edit" element={<EditSale />} />
        <Route path="/sales/estimates" element={<SaleEstimates />} />
        <Route path="/sales/estimates/:id" element={<ViewEstimate />} />
        <Route path="/sales/estimates/:id/edit" element={<EditSale />} />
        <Route path="/sales/proforma" element={<SaleEstimates />} />
        <Route path="/sales/proforma/:id" element={<ViewProforma />} />
        <Route path="/sales/proforma/:id/edit" element={<EditSale />} />
        <Route path="/sales/orders" element={<SaleOrders2 />} />
        <Route path="/sales/orders/:id" element={<ViewOrder />} />
        <Route path="/sales/orders/:id/edit" element={<EditSale />} />
        <Route path="/sales/payments" element={<SalePayments />} />
        <Route path="/sales/new" element={<CreateSale />} />
        <Route path="/sales/estimates/new" element={<CreateSale />} />
        <Route path="/sales/proforma/new" element={<CreateSale />} />
        <Route path="/sales/orders/new" element={<CreateSale />} />
        <Route path="/sales/challans/new" element={<CreateSale />} />
        <Route path="/sales/returns/new" element={<CreateSale />} />
        <Route path="/sales/:id" element={<ViewSale />} />
        <Route path="/sales/:id/edit" element={<EditSale />} />
        <Route path="/dashboard/import-data" element={<ImportData />} />
        <Route path="/dashboard/import-barcode" element={<ImportFromBarcode />} />
        <Route path="/products/barcode-labels" element={<BarcodeLabelPrint />} />
<Route path="/dashboard/export-data" element={<ExportData />} />
        <Route path="/purchases" element={<PurchaseBills />} />
        <Route path="/purchases/bills" element={<PurchaseBills />} />
        <Route path="/purchases/bills/new" element={<CreatePurchaseBill />} />
        <Route path="/purchases/bills/:id/edit" element={<CreatePurchaseBill />} />
        <Route path="/purchases/payment-out" element={<PaymentOut />} />
        <Route path="/purchases/expenses" element={<Expenses />} />
        <Route path="/purchases/expenses/new" element={<CreateExpense />} />
        <Route path="/purchases/expenses/:id/edit" element={<CreateExpense />} />
        <Route path="/purchases/orders" element={<PurchaseOrder />} />
        <Route path="/purchases/returns" element={<PurchaseReturn />} />
        <Route path="/purchases/returns/new" element={<CreateDebitNote />} />
        <Route path="/purchases/returns/:id/edit" element={<CreateDebitNote />} />
        <Route path="/suppliers/:id/ledger" element={<SupplierLedger />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/cash-bank" element={<BankAccounts />} />
        <Route path="/cash-bank/accounts" element={<BankAccounts />} />
        <Route path="/cash-bank/cash-in-hand" element={<CashInHand />} />
        <Route path="/cash-bank/cheques" element={<Cheques />} />
        <Route path="/cash-bank/loans" element={<LoanAccounts />} />
        <Route path="/party-transfer" element={<PartyToPartyTransfer />} />
        <Route path="/journal-entry" element={<JournalEntry />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/account-statements" element={<AccountStatements />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/support" element={<Support />} />
        <Route path="/company" element={<Company />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/utilities/import-items" element={<ImportItems />} />
        <Route path="/utilities/setup-business" element={<SetupMyBusiness />} />
        <Route path="/utilities/accountant-access" element={<AccountantAccess />} />
        <Route path="/utilities/barcode-generator" element={<BarcodeGenerator />} />
        <Route path="/utilities/update-items-bulk" element={<UpdateItemsInBulk />} />
        <Route path="/utilities/import-tally" element={<ImportFromTally />} />
        <Route path="/utilities/import-parties" element={<ImportParties />} />
        <Route path="/utilities/track-salesmen" element={<TrackYourSalesmen />} />
        <Route path="/utilities/export-tally" element={<ExportToTally />} />
        <Route path="/utilities/export-items" element={<ExportItemsPage />} />
        <Route path="/utilities/verify-data" element={<VerifyMyData />} />
        <Route path="/utilities/close-financial-year" element={<CloseFinancialYear />} />
        <Route path="/reports" element={<Reports />}>
          <Route index element={null} />
          <Route path="sale" element={<SaleReport />} />
          <Route path="purchase" element={<PurchaseReport />} />
          <Route path="day-book" element={<DayBookReport />} />
          <Route path="all-transactions" element={<AllTransactionsReport />} />
          <Route path="profit-and-loss" element={<ProfitLossReport />} />
          <Route path="bill-wise-profit" element={<GenericReport reportName="Bill Wise Profit" />} />
          <Route path="cash-flow" element={<CashFlowReport />} />
          <Route path="trial-balance-report" element={<TrialBalanceReport />} />
          <Route path="balance-sheet" element={<BalanceSheetReport />} />
          <Route path="party-statement" element={<PartyStatement />} />
          <Route path="party-wise-profit-and-loss" element={<PartyWiseProfitLoss />} />
          <Route path="all-parties" element={<AllParties />} />
          <Route path="party-report-by-item" element={<PartyReportByItem />} />
          <Route path="sale-purchase-by-party" element={<SalePurchaseByParty />} />
          <Route path="sale-purchase-by-party-group" element={<SalePurchaseByPartyGroup />} />
          <Route path="gstr-1" element={<GSTR1 />} />
          <Route path="gstr-2" element={<GSTR2 />} />
          <Route path="gstr-3b" element={<GSTR3B />} />
          <Route path="gstr-9" element={<GSTR9 />} />
          <Route path="sale-summary-by-hsn" element={<SaleSummaryByHSN />} />
          <Route path="sac-report" element={<SACReport />} />
          <Route path="stock-summary" element={<StockSummary />} />
          <Route path="item-report-by-party" element={<ItemReportByParty />} />
          <Route path="item-wise-profit-and-loss" element={<ItemWiseProfitLoss />} />
          <Route path="item-category-wise-profit-and-loss" element={<ItemCategoryWiseProfitLoss />} />
          <Route path="low-stock-summary" element={<LowStockSummary />} />
          <Route path="stock-detail" element={<StockDetail />} />
          <Route path="stock-aging" element={<StockAging />} />
          <Route path="item-detail" element={<ItemDetail />} />
          <Route path="sale-purchase-report-by-item-category" element={<GenericReport reportName="Sale/Purchase Report By Item Category" />} />
          <Route path="stock-summary-report-by-item-category" element={<GenericReport reportName="Stock Summary Report By Item Category" />} />
          <Route path="item-wise-discount" element={<GenericReport reportName="Item Wise Discount" />} />
          <Route path="business-status" element={<BusinessStatus />} />
          <Route path="bank-statement" element={<BankStatement />} />
          <Route path="discount-report" element={<DiscountReport />} />
          <Route path="gst-report" element={<GSTReport />} />
          <Route path="gstr-2a-reconciliation" element={<GSTR2AReconciliation />} />
          <Route path="gst-rate-report" element={<GSTRateReport />} />
          <Route path="form-no.-27eq" element={<Form27EQ />} />
          <Route path="tcs-receivable" element={<TCSReceivable />} />
          <Route path="tds-payable" element={<TDSPayable />} />
          <Route path="tds-receivable" element={<TDSReceivable />} />
          <Route path="expense" element={<ExpenseReport />} />
          <Route path="expense-category-report" element={<ExpenseCategoryReport />} />
          <Route path="expense-item-report" element={<ExpenseItemReport />} />
          <Route path="sale-orders" element={<SaleOrders />} />
          <Route path="sale-order-item" element={<SaleOrderItem />} />
          <Route path="pending-orders" element={<GenericReport reportName="Pending Orders" />} />
          <Route path="payment-reminders" element={<PaymentReminder />} />
          <Route path="loan-summary" element={<GenericReport reportName="Loan Summary" />} />
          <Route path="emi-schedule" element={<GenericReport reportName="EMI Schedule" />} />
          <Route path="loan-statement" element={<LoanStatement />} />
        </Route>
      </Route>
      <Route path="/business-setup" element={<ProtectedRoute><BusinessSetup /></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
};

export default AppRoutes;

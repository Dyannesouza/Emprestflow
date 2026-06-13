import { createBrowserRouter } from "react-router";
import AuthLayout from "./components/AuthLayout";
import Root from "./components/Root";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import ClientDetails from "./pages/ClientDetails";
import Contracts from "./pages/Contracts";
import ContractForm from "./pages/ContractForm";
import ContractDetails from "./pages/ContractDetails";
import Financial from "./pages/Financial";
import TransactionForm from "./pages/TransactionForm";
import TransactionDetails from "./pages/TransactionDetails";
import NotFound from "./pages/NotFound";
import DueReminders from "./pages/DueReminders";
import BillingCalendar from "./pages/BillingCalendar";
import PublicRegistration from "./pages/PublicRegistration";
import Security from "./pages/Security";
import Users from "./pages/Users";
import ChangePassword from "./pages/ChangePassword";
import AuthDebug from "./pages/AuthDebug";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/auth-debug",
        Component: AuthDebug,
      },
      {
        path: "/",
        Component: Root,
        children: [
          { index: true, Component: Dashboard },
          { path: "clients", Component: Clients },
          { path: "clients/new", Component: ClientForm },
          { path: "clients/:id", Component: ClientDetails },
          { path: "clients/:id/edit", Component: ClientForm },
          { path: "contracts", Component: Contracts },
          { path: "contracts/new", Component: ContractForm },
          { path: "contracts/:id", Component: ContractDetails },
          { path: "contracts/:id/edit", Component: ContractForm },
          { path: "financial", Component: Financial },
          { path: "financial/transactions/new", Component: TransactionForm },
          { path: "financial/transactions/:id/edit", Component: TransactionForm },
          { path: "financial/transactions/:id", Component: TransactionDetails },
          { path: "automatic-billing", Component: BillingCalendar },
          { path: "reminders", Component: DueReminders },
          { path: "security", Component: Security },
          { path: "users", Component: Users },
          { path: "change-password", Component: ChangePassword },
          { path: "*", Component: NotFound },
        ],
      },
    ],
  },
  // Public routes (no auth required)
  {
    path: "/cadastro",
    Component: PublicRegistration,
  },
]);

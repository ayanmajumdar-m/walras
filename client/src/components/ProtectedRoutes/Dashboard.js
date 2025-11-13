import React from "react";
import "./Dashboard.css";
import Home from "./DashboardContent/Home";
import Profile from "./DashboardContent/Profile";
import SubmitTicket from "./DashboardContent/SubmitTicket";
import Wallet from "./DashboardContent/Wallet";
import Deploy from "./DashboardContent/Deploy";
import Logs from "./DashboardContent/Logs";
import Domain from "./DashboardContent/Domain";

const tabContent = {
  home: <Home/>,
  profile: <Profile/>,
  privacy: <div>Manage your Data & Privacy here</div>,
  notifications: <div>Manage your Notifications here</div>,
  submitTicket: <div><SubmitTicket/></div>,
  wallet: <Wallet/>,
  deploy: <Deploy/>,
  logs: <Logs/>,
  domain: <Domain/>
};

const Dashboard = ({ activeTab }) => {
  return <main className="dashboard-main">{tabContent[activeTab]}</main>;
};

export default Dashboard;

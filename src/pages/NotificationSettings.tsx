import { Navigate } from "react-router-dom";

export default function NotificationSettings() {
  return <Navigate to="/settings/company?tab=overview&section=email-setup" replace />;
}

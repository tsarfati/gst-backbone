import { Navigate } from "react-router-dom";

export default function NotificationSettings() {
  return <Navigate to="/profile-settings?tab=notifications" replace />;
}

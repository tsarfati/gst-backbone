import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function JobCostBudgetView() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the dedicated page
    if (id) {
      navigate(`/jobs/${id}/cost-budget`);
    }
  }, [id, navigate]);

  return null;
}

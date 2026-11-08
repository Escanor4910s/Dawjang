import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Stats from "./Stats";

export default function GapsReport() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/stats?view=lacunes", { replace: true });
  }, [navigate]);
  return <Stats />;
}

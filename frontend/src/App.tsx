import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import ControlTower from "./pages/ControlTower";
import CaseDetail from "./pages/CaseDetail";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ControlTower />} />
        <Route path="fall/:id" element={<CaseDetail />} />
        <Route path="kennzahlen" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

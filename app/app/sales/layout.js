import SalesTabs from "./SalesTabs";

export default function SalesLayout({ children }) {
  return <div className="stack"><SalesTabs />{children}</div>;
}

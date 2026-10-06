import { Link } from "react-router-dom";
import { useSavedPriceDrops } from "../hooks/useSavedPriceDrops";

export default function SavedNavLink() {
  const drops = useSavedPriceDrops();
  return (
    <Link
      to="/saved"
      className={`hover:text-white px-1 ${drops > 0 ? "font-bold text-white" : ""}`}
      title={drops > 0 ? `${drops} saved ${drops === 1 ? "listing" : "listings"} dropped in price since you saved` : undefined}
    >
      saved {drops > 0 && `(${drops}↓)`}
    </Link>
  );
}

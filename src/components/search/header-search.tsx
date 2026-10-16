"use client";

import { usePathname } from "next/navigation";
import { SearchBox } from "./search-box";

/** Header search; hidden on the home page, whose hero already has the primary search field. */
export function HeaderSearch() {
  if (usePathname() === "/") return null;
  return <SearchBox />;
}

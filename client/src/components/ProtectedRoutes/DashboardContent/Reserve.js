import React from "react";
import { ComputeConfigurator } from "./Create";

/*
  Reserve & Save: a Virtual Machine reserved for 3–36 months from today,
  paid up front at a discount. Its own page; the order form is the same one
  the Create page uses for monthly VMs, in "reserved" mode.
*/
const Reserve = () => (
  <div className="cx-page">
    <div className="cx-page-head">
      <h2>Reserve &amp; Save</h2>
      <p>Reserve a Virtual Machine for 3 to 36 months, pay up front and save up to 25% on the monthly price.</p>
    </div>
    <ComputeConfigurator mode="reserved" />
  </div>
);

export default Reserve;

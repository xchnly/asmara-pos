"use client";

import React from "react";

type ReceiptProps = {
  data: {
    productName: string;
    qty: number;
    price: number;
    total: number;
    date: Date;
  };
};

export default function Receipt({ data }: ReceiptProps) {
  return (
    <div
      id="receipt"
      className="w-[280px] text-sm font-mono text-black"
    >
      <div className="text-center mb-2">
        <strong>RM NASI PADANG ASMARA</strong>
        <br />
        <span>Terima kasih 🙏</span>
      </div>

      <hr />

      <div className="my-2">
        <div>{data.productName}</div>
        <div className="flex justify-between">
          <span>
            {data.qty} x Rp {data.price.toLocaleString()}
          </span>
          <span>
            Rp {data.total.toLocaleString()}
          </span>
        </div>
      </div>

      <hr />

      <div className="flex justify-between font-bold mt-2">
        <span>TOTAL</span>
        <span>Rp {data.total.toLocaleString()}</span>
      </div>

      <div className="text-center mt-4 text-xs">
        {data.date.toLocaleString()}
        <br />
        *** SIMPAN STRUK INI ***
      </div>
    </div>
  );
}

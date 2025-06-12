import { forwardRef } from "react";
import BarcodeImage from "../barcode";

interface PrintableBarcodeProps {
  product: {
    name: string;
    barcode: string;
  };
  quantity: number;
}

const PrintableBarcode = forwardRef<HTMLDivElement, PrintableBarcodeProps>(
  ({ product, quantity }, ref) => {
    const perRow = 2;
    const perPage = 12;
    const stickers = Array.from({ length: quantity });

    return (
      <div ref={ref}>
        <style>{`
          @media print {
            @page {
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .page-offset {
              height: 12mm;
            }
            .sticker-row {
              display: flex;
              margin-bottom: 4mm;
              margin-left: 20mm;
              break-inside: avoid;
            }
            .sticker {
              width: 45mm;
              height: 21mm;
              background: #fff;
              border-radius: 2mm;
              margin-right: 4mm;
              text-align: center;
              break-inside: avoid;
            }
            .sticker:last-child {
              margin-right: 0;
            }
            .sticker-name {
              font-size: 1.8mm;
              margin-top: 0.5mm;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }
          }
        `}</style>

        {stickers.map((_, i) => {
          const isFirstInRow = i % perRow === 0;
          const isNewPage = i > 0 && i % perPage === 0;

          if (isFirstInRow) {
            const rowStickers = stickers.slice(i, i + perRow);

            return (
              <div key={`row-${i}`}>
                {isNewPage && <div className="page-offset" />}
                <div className="sticker-row">
                  {rowStickers.map((_, j) => (
                    <div key={`sticker-${i + j}`} className="sticker">
                      <div className="sticker-name">{product.name}</div>
                      <BarcodeImage value={product.barcode} />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  }
);

export default PrintableBarcode;

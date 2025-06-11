import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeImageProps {
  value: string;
}

const BarcodeImage: React.FC<BarcodeImageProps> = ({ value }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        lineColor: "#000",
         width: 1.2,           
        height: 50,
        displayValue: true,
        fontSize: 10,
        textAlign: "center", 
        textMargin: 2,
        margin: 0,
      });
    }
  }, [value]);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg
        ref={svgRef}
        style={{
          height: "16mm",
          width: "auto",
          display: "block",
        }}
      />
    </div>
  );
};

export default BarcodeImage;

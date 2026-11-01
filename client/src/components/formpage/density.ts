import { createContext, useContext } from "react";

/**
 * Form density. Anything rendered inside a <FormPage> is "compact": shorter
 * inputs, smaller labels, tighter gaps — so a whole form fits on one desktop
 * screen without scrolling. Pages that are not on FormPage yet keep the old
 * roomy look, so screens can move over one at a time.
 */
export type FormDensity = "comfortable" | "compact";

export const FormDensityContext = createContext<FormDensity>("comfortable");

export const useFormDensity = () => useContext(FormDensityContext);
export const useIsCompact = () => useContext(FormDensityContext) === "compact";

import { createContext, useContext } from "react";

// Inside a <FormPage> forms are compact so a whole form fits on one screen.
export type FormDensity = "comfortable" | "compact";

export const FormDensityContext = createContext<FormDensity>("comfortable");

export const useFormDensity = () => useContext(FormDensityContext);
export const useIsCompact = () => useContext(FormDensityContext) === "compact";

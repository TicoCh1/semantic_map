import { GlassSelect } from "@form-glass/react";
import { Children, isValidElement, type ReactNode } from "react";

type OptionProps = { value?: string | number; children?: ReactNode };
function optionsFrom(children: ReactNode): { value: string; label: string }[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === "option") return [{ value: String(child.props.value ?? child.props.children ?? ""), label: Children.toArray(child.props.children).join("") }];
    return optionsFrom(child.props.children);
  });
}
/** Keep option declarations while delegating listbox behavior and visuals to FORM. */
export function ThemedSelect({ children, value, onValueChange, disabled, label }: {
  children: ReactNode;
  value: string | number | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return <GlassSelect label={label} value={String(value ?? "")} options={optionsFrom(children)} onChange={onValueChange} disabled={disabled} />;
}

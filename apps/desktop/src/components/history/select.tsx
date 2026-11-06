import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@diskpond/ui/select";
import { useId } from "react";

export function HistorySelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      <Select
        value={value}
        items={items}
        onValueChange={(next) => next !== null && onChange(next)}
      >
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

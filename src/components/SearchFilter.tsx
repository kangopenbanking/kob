import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterOptions?: { label: string; value: string }[];
  selectedFilter?: string;
  onFilterChange?: (value: string) => void;
  placeholder?: string;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  filterOptions,
  selectedFilter,
  onFilterChange,
  placeholder = "Search...",
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {filterOptions && onFilterChange && (
        <Select value={selectedFilter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

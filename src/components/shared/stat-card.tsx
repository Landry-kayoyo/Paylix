import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | React.ReactNode;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  valueClassName?: string;
  highlight?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className, valueClassName, highlight }: StatCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      highlight ? "bg-primary text-primary-foreground border-transparent shadow-[var(--shadow-premium-hover)]" : "bg-card border-border/60 hover:shadow-[var(--shadow-premium-hover)]",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className={cn(
          "text-sm font-medium",
          highlight ? "text-primary-foreground/90" : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          highlight ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("max-w-full break-words text-3xl font-semibold leading-tight tracking-tight", valueClassName)}>{value}</div>
        {trend && (
          <p className={cn(
            "text-xs mt-2 flex items-center gap-1",
            highlight 
              ? "text-primary-foreground/80" 
              : trendUp ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"
          )}>
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

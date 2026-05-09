import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Monitor, BookOpen, Target, TrendingUp, Clock } from "lucide-react";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-dashboard text-foreground bg-doodle-watermark font-sans overflow-x-hidden px-4 pt-2 pb-6 sm:px-8 sm:pt-4 sm:pb-8">
      <div className="max-w-[1600px] mx-auto space-y-8 relative">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Header Section Skeleton */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 relative z-10 animate-pulse">
          <div>
            <Skeleton className="h-12 sm:h-16 lg:h-20 w-72 mb-6 rounded-2xl" />
            <div className="flex gap-4 mt-6">
               <div className="flex flex-col gap-1 w-24">
                 <Skeleton className="h-4 w-12 mb-1" />
                 <Skeleton className="h-8 w-full rounded-full" />
               </div>
               <div className="flex flex-col gap-1 w-24">
                 <Skeleton className="h-4 w-16 mb-1" />
                 <Skeleton className="h-8 w-full rounded-full" />
               </div>
            </div>
          </div>
          
          <div className="flex gap-8 sm:gap-12 lg:pb-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-4 w-12 mb-2" />
                <Skeleton className="h-12 sm:h-16 w-16 rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        {/* Main Grid Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-card/40 backdrop-blur-xl border border-border rounded-[2rem] p-6 h-[280px]">
              <div className="mt-32">
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-10 w-full rounded-full" />
              </div>
            </Card>

            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-3xl" />
              ))}
            </div>
          </div>

          {/* MIDDLE COLUMN */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-8 border border-border h-[240px]">
                <div className="flex justify-between mb-6">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <Skeleton className="h-12 w-20 mb-4" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </Card>

              <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-8 border border-border h-[240px]">
                <div className="flex justify-between mb-6">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex flex-col items-center justify-center pt-4">
                  <Skeleton className="h-32 w-32 rounded-full" />
                </div>
              </Card>
            </div>

            <Card className="bg-card/60 backdrop-blur-xl rounded-[2rem] p-8 border border-border flex-1">
              <div className="flex justify-between mb-8">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-6">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-16 flex-1 rounded-2xl" />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-3 h-full">
            <Card className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl h-full border-0">
              <div className="flex justify-between mb-8">
                <Skeleton className="h-8 w-24 bg-white/10" />
                <Skeleton className="h-10 w-12 bg-white/10" />
              </div>
              <Skeleton className="h-8 w-full rounded-full bg-white/10 mb-8" />
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full bg-white/10" />
                      <Skeleton className="h-3 w-2/3 bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

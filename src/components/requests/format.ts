export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const formatMoney = (amount: number) => {
  const formatted = new Intl.NumberFormat("en-IN", { 
    style: "currency", 
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
  
  // Ensure proper rupee symbol display
  return formatted.replace(/^INR\s?/, '₹ ');
};

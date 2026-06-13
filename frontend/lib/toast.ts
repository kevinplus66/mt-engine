import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";

let successReplayOdd = false;
let errorReplayOdd = false;

const toast = Object.assign(
  ((
    message: Parameters<typeof sonnerToast>[0],
    data?: Parameters<typeof sonnerToast>[1],
  ) => sonnerToast(message, data)) as typeof sonnerToast,
  sonnerToast,
  {
    success(
      message: Parameters<typeof sonnerToast.success>[0],
      data?: Parameters<typeof sonnerToast.success>[1],
    ) {
      successReplayOdd = !successReplayOdd;

      return sonnerToast.success(message, {
        ...data,
        className: cn(
          data?.className,
          successReplayOdd ? "toast-success-odd" : "toast-success-even",
        ),
      });
    },
    error(
      message: Parameters<typeof sonnerToast.error>[0],
      data?: Parameters<typeof sonnerToast.error>[1],
    ) {
      errorReplayOdd = !errorReplayOdd;

      return sonnerToast.error(message, {
        ...data,
        className: cn(
          data?.className,
          errorReplayOdd ? "toast-error-odd" : "toast-error-even",
        ),
      });
    },
  },
);

export { toast };

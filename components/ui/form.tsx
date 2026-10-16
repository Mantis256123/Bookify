import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";

const Form = FormProvider;

const FormField = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  props: ControllerProps<TFieldValues, TName>,
) => <Controller {...props} />;

const FormItem = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div className={cn("space-y-2", className)} {...props} />
);

const FormLabel = ({
  className,
  ...props
}: React.ComponentProps<"label">) => (
  <label className={cn("label block", className)} {...props} />
);

const FormControl = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const FormMessage = ({
  className,
  name,
}: {
  className?: string;
  name: string;
}) => {
  const { getFieldState } = useFormContext();
  const error = getFieldState(name).error;

  return error?.message ? (
    <p className={cn("text-sm text-red-600", className)}>
      {String(error.message)}
    </p>
  ) : null;
};

export { Form, FormControl, FormField, FormItem, FormLabel, FormMessage };

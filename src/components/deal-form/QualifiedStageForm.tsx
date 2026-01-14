
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Deal } from "@/types/deal";
import { FormFieldRenderer } from "./FormFieldRenderer";

interface QualifiedStageFormProps {
  formData: Partial<Deal>;
  onFieldChange: (field: string, value: any) => void;
  fieldErrors: Record<string, string>;
}

export const QualifiedStageForm = ({ formData, onFieldChange, fieldErrors }: QualifiedStageFormProps) => {
  const fields = ['customer_challenges', 'budget', 'probability', 'expected_closing_date', 'is_recurring', 'internal_comment'];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Qualified Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map(field => (
            <div key={field} className={field === 'internal_comment' ? 'md:col-span-2 lg:col-span-3' : ''}>
              <FormFieldRenderer
                field={field}
                value={formData[field as keyof Deal]}
                onChange={onFieldChange}
                error={fieldErrors[field]}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

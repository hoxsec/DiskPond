import {
  S3CompatibleForm,
  type S3CompatibleFormProps,
} from "@desktop/components/forms/providers/s3-compatible";

export function DiskPondCloudForm(props: S3CompatibleFormProps) {
  return <S3CompatibleForm {...props} provider="DISKPOND_CLOUD" />;
}

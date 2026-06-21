export default function SignatureUpload({
  onLoaded,
}: {
  onLoaded: (imageData: string) => void;
}) {
  return (
    <label className="block rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      上传电子签名图片
      <input
        type="file"
        accept="image/png,image/jpeg"
        className="mt-3 block w-full text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onLoaded(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}

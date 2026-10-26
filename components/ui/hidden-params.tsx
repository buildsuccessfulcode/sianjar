export function HiddenParams({
  params,
}: {
  params: Record<string, string | number | undefined>;
}) {
  return (
    <>
      {Object.entries(params).map(([key, value]) =>
        value === undefined || value === "" ? null : (
          <input key={key} type="hidden" name={key} value={value} />
        ),
      )}
    </>
  );
}

// Highlighted placeholder for a field that has to be filled in before going public.
export function Fill({ children }: { children: React.ReactNode }) {
  return <span className="todo-fill">{children}</span>;
}

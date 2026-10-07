import Icon from "./Icon";

export default function PreviewNote({ children }) {
  return (
    <div className="notice info small">
      <Icon name="sparkle" />
      <span><strong>Preview with sample data.</strong> {children}</span>
    </div>
  );
}

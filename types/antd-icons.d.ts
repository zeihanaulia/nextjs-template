// @ant-design/icons@4.x types are missing onPointerEnterCapture / onPointerLeaveCapture
// required by @types/react@18. This augmentation makes them optional so existing
// icon usage compiles without touching every call site.
import "@ant-design/icons";

declare module "@ant-design/icons/lib/components/AntdIcon" {
  interface AntdIconProps {
    onPointerEnterCapture?: React.PointerEventHandler<HTMLSpanElement>;
    onPointerLeaveCapture?: React.PointerEventHandler<HTMLSpanElement>;
  }
}

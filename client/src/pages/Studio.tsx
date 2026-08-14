import EditorProvider from "../context/EditorProvider";
import Editor from "../Studio/Editor/Editor";

export default function Studio() {
  return (
    <EditorProvider>
      <Editor />
    </EditorProvider>
  );
}
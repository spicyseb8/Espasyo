import EditorProvider from "./context/EditorProvider";

import Editor from "./ui/Editor/Editor";

function App() {

    return (

        <EditorProvider>

            <Editor />

        </EditorProvider>

    );

}

export default App;
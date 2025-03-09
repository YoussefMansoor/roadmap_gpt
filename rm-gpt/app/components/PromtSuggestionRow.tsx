import PromtSuggestionButton from "./PromtSuggestionButton"

const PromtSuggestionRow = ({onPromptClick}) => {
    const prompts = [
        "Give me a Software Engineer Roadmap",
        "Give me a AI Engineer Roadmap",
        "How to Start as a LLM Engineer",
        "How to start as a Datascientist"
    ]
    return (
         <div className="promt-suggestion-row"> {prompts.map((prompt,index) => <PromtSuggestionButton key = {`suggestion-${index}`} text={prompt} onClick= {() => onPromptClick(prompt)}/> )} </div>
    )
    }
    
    export default PromtSuggestionRow
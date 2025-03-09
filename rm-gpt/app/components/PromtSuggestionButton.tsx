const PromtSuggestionButton  = ({text, onClick}) => {
    return (
        <button className="promt-suggestion-button" onClick={onClick}> {text} </button>
    )
}

export default PromtSuggestionButton
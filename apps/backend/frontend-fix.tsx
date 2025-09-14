// Frontend Fix - Add this to your message rendering component

// Your current code (simplified) - ONLY showing text:
const CurrentMessageComponent = ({ message }) => {
  return (
    <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
      <div className="markdown-content">
        <p>{message.response}</p>
      </div>
      <p className="text-xs opacity-70 mt-1">6:52:55 AM</p>
    </div>
  );
};

// FIXED VERSION - Renders both text AND chart:
const FixedMessageComponent = ({ message }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    // Execute scripts in chartHtml when it's rendered
    if (chartRef.current && message.chartHtml) {
      const scripts = chartRef.current.getElementsByTagName('script');
      Array.from(scripts).forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  }, [message.chartHtml]);

  return (
    <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
      <div className="markdown-content">
        <p>{message.response}</p>
      </div>
      
      {/* ADD THIS SECTION - Render the chart! */}
      {message.hasChart && message.chartIframe && (
        <div className="mt-4">
          <div dangerouslySetInnerHTML={{ __html: message.chartIframe }} />
        </div>
      )}
      
      {/* OR use chartHtml with script execution */}
      {message.hasChart && message.chartHtml && !message.chartIframe && (
        <div className="mt-4" ref={chartRef}>
          <div dangerouslySetInnerHTML={{ __html: message.chartHtml }} />
        </div>
      )}
      
      <p className="text-xs opacity-70 mt-1">6:52:55 AM</p>
    </div>
  );
};

// SIMPLEST FIX - Just add the iframe after the text:
const SimplestFix = ({ message }) => {
  return (
    <div className="max-w-[70%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
      <div className="markdown-content">
        <p>{message.response}</p>
      </div>
      
      {/* Just add this one line! */}
      {message.chartIframe && (
        <div dangerouslySetInnerHTML={{ __html: message.chartIframe }} />
      )}
      
      <p className="text-xs opacity-70 mt-1">6:52:55 AM</p>
    </div>
  );
};
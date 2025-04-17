import { useState } from "react"

// function IndexPopup() {
//   const [data, setData] = useState("")

//   return (
//     <div
//       style={{
//         display: "flex",
//         flexDirection: "column",
//         padding: 16
//       }}>
//       <h1>
//         Welcome to your <a href="https://www.plasmo.com">Plasmo</a> Extension!
//       </h1>
//       <input onChange={(e) => setData(e.target.value)} value={data} />
//       <footer>Crafted by @PlasmoHQ</footer>
//     </div>
//   )
// }

// export default IndexPopup

const Popup = () => {
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadStatus("") // 清除之前的提示信息
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("请先选择文件")
      return
    }

    setIsUploading(true)
    setUploadStatus("正在上传...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("http://localhost:3000/resume/upload", {
        method: "POST",
        body: formData
      })

      if (response.ok) {
        setUploadStatus("上传成功！")
        setFile(null) // 上传成功后清除文件
      } else {
        setUploadStatus("上传失败，请重试")
      }
    } catch (error) {
      setUploadStatus("上传出错：" + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const openHomePage = () => {
    chrome.tabs.create({ url: "tabs/home.html" })
  }

  return (
    <div style={{ 
      padding: "24px", 
      width: "320px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h2 style={{ 
          margin: 0,
          fontSize: "18px",
          color: "#333",
          fontWeight: 500
        }}>文件上传</h2>
        <button
          onClick={openHomePage}
          style={{
            padding: "6px 12px",
            backgroundColor: "transparent",
            color: "#4CAF50",
            border: "1px solid #4CAF50",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.3s ease"
          }}>
          打开主页
        </button>
      </div>
      
      <div style={{ 
        marginBottom: "20px",
        border: "2px dashed #ddd",
        borderRadius: "8px",
        padding: "20px",
        textAlign: "center",
        backgroundColor: "#fafafa",
        transition: "all 0.3s ease"
      }}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
          onChange={handleFileChange}
          style={{ 
            display: "none"
          }}
          id="fileInput"
        />
        <label 
          htmlFor="fileInput"
          style={{
            display: "block",
            cursor: "pointer",
            color: "#666"
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            {file ? (
              <span style={{ color: "#4CAF50", fontWeight: 500 }}>
                已选择: {file.name}
              </span>
            ) : (
              <span>点击或拖拽文件到此处</span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#999" }}>
            支持 PDF、Word、图片格式
          </div>
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        style={{
          width: "100%",
          padding: "10px 16px",
          backgroundColor: !file || isUploading ? "#ccc" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: !file || isUploading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 500,
          transition: "all 0.3s ease"
        }}>
        {isUploading ? "上传中..." : "上传文件"}
      </button>

      {uploadStatus && (
        <p style={{ 
          marginTop: "12px", 
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "14px",
          backgroundColor: uploadStatus.includes("成功") ? "#e8f5e9" : "#ffebee",
          color: uploadStatus.includes("成功") ? "#2e7d32" : "#c62828",
          textAlign: "center"
        }}>
          {uploadStatus}
        </p>
      )}
    </div>
  )
}

export default Popup

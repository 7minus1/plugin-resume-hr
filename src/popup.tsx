import { useState, useEffect } from "react"
import { getCurrentUser, isAuthenticated } from "./services/authService"

const Popup = () => {
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [user, setUser] = useState<{ email: string; username?: string } | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const checkUser = async () => {
      console.log('Checking authentication status...');
      const isAuth = await isAuthenticated();
      console.log('Is authenticated:', isAuth);
      
      if (isAuth) {
        const currentUser = await getCurrentUser();
        console.log('Current user:', currentUser);
        if (currentUser) {
          setUser(currentUser);
        }
      } else {
        console.log('User is not authenticated');
        setUser(null);
      }
    };
    
    checkUser();
  }, []);

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

      // 获取认证令牌
      const result = await chrome.storage.local.get(['access_token']);
      const token = result.access_token;

      if (!token) {
        setError("请先登录");
        return;
      }

      const response = await fetch("http://localhost:3000/api/resume/upload", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
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
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
          {user ? (
            <>
              <span style={{ 
                maxWidth: "120px", 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap" 
              }}>
                {user.username}
              </span>
              <span>→</span>
            </>
          ) : (
            "未登录 →"
          )}
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

      {error && (
        <p style={{ 
          marginTop: "12px", 
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "14px",
          backgroundColor: "#ffebee",
          color: "#c62828",
          textAlign: "center"
        }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default Popup
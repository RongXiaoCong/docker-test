const http = require('http')
const {execSync} = require('child_process')
const path = require('path')
const fs = require('fs')

// 递归删除目录
function deleteFolderRecursive (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file) {
        const curPath = path + '/' + file
        if (fs.stateSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath)
        } else {
          fs.unlinkSync(curPath)
        }
      }
    )
    fs.rmdirSync(path)
  }
}

const resolvePost = req =>
  new Promise(resolve => {
    req.on('data', data => {
      chunk += data
    })
    req.on('end', () => {
      resolve(JSON.parse(chunk))
    })
  })

http.createServer(async (req, res) => {
  console.log('receive request')
  console.log(req.url)
  if (req.method === 'POST' && req.url === '/') {
    const data = await resolvePost(req)
    const projectDir = path.resolve(`./${data.repository.name}`)
    deleteFolderRecursive(projectDir)

    // 拉取仓库最新代码
    execSync(`git clone https://github.com/RongXiaoCong/${data.repository.name}.git ${projectDir}`, {stdio: 'inherit'})

    // 复制Dockerfile到项目里
    fs.copyFileSync(path.resolve(`./Dockerfile`), path.resolve(projectDir, './Dockerfile'))

    // 复制.dockerignore到项目里
    fs.copyFileSync(path.resolve(__dirname, `./.dockerignore`), path.resolve(projectDir, './.dockerignore'))

    // 复制docker镜像
    execSync(`docker build . -t ${data.repository.name}-image:latest`, {stdio: 'inherit', cwd: projectDir})

    // 销毁docker容器
    execSync(`docker ps -a -f "name=^${data.repository.name}-container" --format="{{.Names}}" | xargs -r docker stop | xargs -r docker rm`,
      {stdio: 'inherit'})

    // 创建docker容器
    execSync(`docker run -d -p 8888:80 --name${data.repository.name}-container ${data.repository.name}-image:latest`,
      {stdio: 'inherit'})

    console.log('deploy success')
    res.end('ok')
  }
}).listen(3000, () => {
  console.log('server is ready')
})

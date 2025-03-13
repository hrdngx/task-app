// Retrofit用APIインターフェースに新規API追加
interface ApiService {
    // ... 既存のAPI

    // ★ 新規追加：秘密の質問取得API（ユーザ名から取得）
    @GET("secret-question/{username}")
    suspend fun getSecretQuestion(@Path("username") username: String): SecretQuestionResponse

    // ★ 新規追加：パスワードリセットAPI
    @POST("reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): ResetPasswordResponse
}

// 新規データクラス
data class SecretQuestionResponse(
    val success: Boolean,
    val secretQuestion: String?, // 未設定の場合はnull
    val message: String? = null
)

data class ResetPasswordRequest(
    val username: String,
    val secretAnswer: String,
    val newPassword: String
)

data class ResetPasswordResponse(
    val success: Boolean,
    val message: String? = null
)

// 既存のプロフィール更新用リクエストに秘密の質問項目を追加
data class ProfileUpdateRequest(
    val userId: Int,
    val displayName: String,
    val description: String?,
    val profileImageBase64: String?,
    val secretQuestion: String?, // ★ 新規項目
    val secretAnswer: String?    // ★ 新規項目
)

// プロフィール画面：秘密の質問設定を追加
@Composable
fun ProfileRegistrationScreen(userId: Int, snackbarHostState: SnackbarHostState) {
    var displayName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var profileImageBase64 by remember { mutableStateOf("") }
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    // ★ 新規：秘密の質問設定用の状態
    var secretQuestion by remember { mutableStateOf("") }
    var secretAnswer by remember { mutableStateOf("") }
    // 用意しておく3つの質問例
    val secretQuestions = listOf(
        "最初に買ったペットの名前は？",
        "中学校のときに住んでいた住所は？",
        "いとこの苗字は？"
    )
    var expanded by remember { mutableStateOf(false) }
    
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(userId) {
        try {
            val response = RetrofitClient.apiService.getProfile(userId)
            if (response.success) {
                displayName = response.displayName ?: ""
                description = response.description ?: ""
                profileImageBase64 = response.profileImageBase64 ?: ""
                // ※ サーバ側で秘密の質問・答えは返さなくてもよい（更新時のみ設定）
            }
        } catch (e: Exception) {
            Log.e(TAG, "プロフィール取得エラー", e)
        } finally {
            isLoading = false
        }
    }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else {
        Box(modifier = Modifier
            .fillMaxSize()
            .background(Color.White), contentAlignment = Alignment.Center) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(8.dp)
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    ProfileImagePreview(profileImageBase64)
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    OutlinedTextField(
                        value = displayName,
                        onValueChange = { displayName = it },
                        label = { Text("表示名（必須）") },
                        modifier = Modifier.fillMaxWidth(),
                        isError = displayName.isBlank()
                    )
                    if (displayName.isBlank()) {
                        Text("表示名は必須です", style = MaterialTheme.typography.labelSmall, color = Color.Red)
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    // 秘密の質問の選択（ドロップダウン）
                    Text("秘密の質問を設定する（任意）", style = MaterialTheme.typography.labelMedium)
                    Box {
                        OutlinedTextField(
                            value = secretQuestion,
                            onValueChange = { /* 読み取り専用 */ },
                            label = { Text("秘密の質問") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { expanded = true },
                            readOnly = true
                        )
                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false }
                        ) {
                            secretQuestions.forEach { question ->
                                DropdownMenuItem(
                                    text = { Text(question) },
                                    onClick = {
                                        secretQuestion = question
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = secretAnswer,
                        onValueChange = { secretAnswer = it },
                        label = { Text("秘密の質問の答え") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // 画像選択ロジック（既存）
                    val launcher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.GetContent()
                    ) { uri: Uri? ->
                        if (uri != null) {
                            selectedImageUri = uri
                            try {
                                val inputStream = context.contentResolver.openInputStream(uri)
                                val bytes = inputStream?.readBytes()
                                if (bytes != null) {
                                    profileImageBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "画像変換エラー", e)
                            }
                        }
                    }
                    ElevatedButton(onClick = { launcher.launch("image/*") }) {
                        Text("プロフィール画像を選択")
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    ElevatedButton(onClick = {
                        coroutineScope.launch {
                            try {
                                if (displayName.isBlank()) {
                                    snackbarHostState.showSnackbar("表示名は必須です")
                                } else {
                                    val response = RetrofitClient.apiService.updateProfile(
                                        ProfileUpdateRequest(
                                            userId,
                                            displayName,
                                            description,
                                            if (profileImageBase64.isNotEmpty()) profileImageBase64 else null,
                                            if (secretQuestion.isNotBlank()) secretQuestion else null,
                                            if (secretAnswer.isNotBlank()) secretAnswer else null
                                        )
                                    )
                                    if (response.success) {
                                        snackbarHostState.showSnackbar("プロフィール更新成功")
                                    } else {
                                        snackbarHostState.showSnackbar("プロフィール更新失敗")
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "プロフィール更新エラー", e)
                                snackbarHostState.showSnackbar("サーバーエラー")
                            }
                        }
                    }, modifier = Modifier.fillMaxWidth()) {
                        Text("プロフィール更新")
                    }
                }
            }
        }
    }
}

// ★ 新規：パスワードリセット画面
@Composable
fun PasswordResetScreen(navController: NavHostController, snackbarHostState: SnackbarHostState) {
    var username by remember { mutableStateOf("") }
    var secretQuestion by remember { mutableStateOf("") }
    var secretAnswer by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    // stage 0: ユーザ名入力、1: 秘密の質問回答画面
    var stage by remember { mutableStateOf(0) }
    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        when (stage) {
            0 -> {
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("ユーザーネーム") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))
                ElevatedButton(onClick = {
                    coroutineScope.launch {
                        try {
                            val response = RetrofitClient.apiService.getSecretQuestion(username)
                            if (response.success && !response.secretQuestion.isNullOrBlank()) {
                                secretQuestion = response.secretQuestion
                                stage = 1
                            } else {
                                snackbarHostState.showSnackbar("秘密の質問が設定されていません。新規登録してください。")
                                navController.navigate("register") {
                                    popUpTo("login") { inclusive = true }
                                }
                            }
                        } catch (e: Exception) {
                            snackbarHostState.showSnackbar("エラーが発生しました。")
                        }
                    }
                }, modifier = Modifier.fillMaxWidth()) {
                    Text("次へ")
                }
            }
            1 -> {
                Text("秘密の質問: $secretQuestion")
                OutlinedTextField(
                    value = secretAnswer,
                    onValueChange = { secretAnswer = it },
                    label = { Text("秘密の質問の答え") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("新しいパスワード") },
                    modifier = Modifier.fillMaxWidth(),
                    visualTransformation = PasswordVisualTransformation()
                )
                Spacer(modifier = Modifier.height(16.dp))
                ElevatedButton(onClick = {
                    coroutineScope.launch {
                        try {
                            val resetResponse = RetrofitClient.apiService.resetPassword(
                                ResetPasswordRequest(username, secretAnswer, newPassword)
                            )
                            if (resetResponse.success) {
                                snackbarHostState.showSnackbar("パスワードがリセットされました。再度ログインしてください。")
                                navController.navigate("login") {
                                    popUpTo("login") { inclusive = true }
                                }
                            } else {
                                snackbarHostState.showSnackbar(resetResponse.message ?: "パスワードリセットに失敗しました。")
                            }
                        } catch (e: Exception) {
                            snackbarHostState.showSnackbar("エラーが発生しました。")
                        }
                    }
                }, modifier = Modifier.fillMaxWidth()) {
                    Text("パスワードリセット")
                }
            }
        }
    }
}

// ログイン画面に「パスワード変更はこちら」のリンクを追加（LoginScreen内）
@Composable
fun LoginScreen(
    navController: NavHostController,
    sessionManager: SessionManager,
    snackbarHostState: SnackbarHostState
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorLog by remember { mutableStateOf("") }
    var passwordVisibility by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
                .align(Alignment.Center),
            shape = MaterialTheme.shapes.medium,
            elevation = CardDefaults.cardElevation(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "集団で\nタスク管理アプリ\nたすくん",
                    style = MaterialTheme.typography.headlineLarge
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("ユーザーネーム") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("パスワード") },
                    visualTransformation = if (passwordVisibility) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisibility = !passwordVisibility }) {
                            Icon(
                                imageVector = if (passwordVisibility) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = if (passwordVisibility) "パスワードを隠す" else "パスワードを表示する"
                            )
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))
                ElevatedButton(
                    onClick = {
                        isLoading = true
                        errorLog = ""
                        coroutineScope.launch {
                            try {
                                val response = RetrofitClient.apiService.login(LoginRequest(username, password))
                                if (response.success && response.token != null && response.userId != null) {
                                    sessionManager.saveAuthToken(response.token)
                                    sessionManager.saveUserId(response.userId)
                                    navController.navigate("main") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                } else {
                                    val errorMsg = "ユーザーネームまたはパスワードが間違っています！"
                                    errorLog = errorMsg
                                    snackbarHostState.showSnackbar(errorMsg)
                                }
                            } catch (e: HttpException) {
                                val errorBody = e.response()?.errorBody()?.string()
                                if (!errorBody.isNullOrEmpty()) {
                                    try {
                                        val errorResponse = Gson().fromJson(errorBody, ErrorResponse::class.java)
                                        errorLog = errorResponse.message
                                        snackbarHostState.showSnackbar(errorResponse.message)
                                    } catch (parseException: Exception) {
                                        val msg = "ログインに失敗しました (HttpException)。"
                                        errorLog = msg
                                        snackbarHostState.showSnackbar(msg)
                                    }
                                } else {
                                    val msg = "ログインに失敗しました (HTTP ${e.code()})。"
                                    errorLog = msg
                                    snackbarHostState.showSnackbar(msg)
                                }
                                Log.e("LoginScreen", "Login error(HttpException)", e)
                            } catch (e: Exception) {
                                Log.e("LoginScreen", "Login error", e)
                                val msg = "サーバーエラーが発生しました。"
                                errorLog = msg
                                snackbarHostState.showSnackbar(msg)
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading
                ) {
                    Text("ログイン")
                }
                Spacer(modifier = Modifier.height(16.dp))
                // 新規登録リンク
                Text(
                    text = "新規登録していない人はこちら",
                    color = LightColorScheme.primary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { navController.navigate("register") },
                    textAlign = TextAlign.Center
                )
                // ★ 新規追加：パスワード変更リンク
                Text(
                    text = "パスワード変更はこちら",
                    color = LightColorScheme.primary,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { navController.navigate("passwordReset") },
                    textAlign = TextAlign.Center
                )
                if (errorLog.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = errorLog,
                        color = Color.Red,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
    }
}

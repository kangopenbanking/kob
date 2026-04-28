import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, CheckCircle2, Smartphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function MobileIntegration() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Mobile Application Integration</h1>
        <p className="text-xl text-muted-foreground">
          Complete guide for integrating Kang Open Banking into iOS, Android, and cross-platform mobile apps
        </p>
      </div>

      <div className="flex gap-3">
        <Badge variant="outline" className="text-base px-4 py-2">
          <Smartphone className="mr-2 h-4 w-4" /> iOS
        </Badge>
        <Badge variant="outline" className="text-base px-4 py-2">
          <Smartphone className="mr-2 h-4 w-4" /> Android
        </Badge>
        <Badge variant="outline" className="text-base px-4 py-2">
          <Smartphone className="mr-2 h-4 w-4" /> React Native
        </Badge>
        <Badge variant="outline" className="text-base px-4 py-2">
          <Smartphone className="mr-2 h-4 w-4" /> Flutter
        </Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Mobile integration requires handling OAuth flows, secure storage, and platform-specific authentication patterns.
        </AlertDescription>
      </Alert>

      {/* iOS Integration */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">iOS Integration (Swift)</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Swift Implementation</CardTitle>
            <CardDescription>Native iOS integration with Swift</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-semibold">1. Create API Service</h4>
            <CodeBlock
              examples={[
                {
                  language: "swift",
                  code: `// KOBAPIService.swift
import Foundation

class KOBAPIService {
    static let shared = KOBAPIService()
    private let baseURL = "https://api.kangopenbanking.com/v1"
    
    private var accessToken: String? {
        get { KeychainHelper.standard.read(key: "kob_access_token") }
        set { 
            if let token = newValue {
                KeychainHelper.standard.save(token, key: "kob_access_token")
            }
        }
    }
    
    func getAccounts(consentId: String) async throws -> AccountsResponse {
        guard let token = accessToken else {
            throw APIError.noToken
        }
        
        let url = URL(string: "\\(baseURL)/aisp-accounts")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        request.setValue(consentId, forHTTPHeaderField: "x-consent-id")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        return try JSONDecoder().decode(AccountsResponse.self, from: data)
    }
    
    func initiatePayment(paymentData: PaymentRequest) async throws -> PaymentResponse {
        guard let token = accessToken else {
            throw APIError.noToken
        }
        
        let url = URL(string: "\\(baseURL)/pisp-domestic-payment")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(paymentData)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        return try JSONDecoder().decode(PaymentResponse.self, from: data)
    }
}

enum APIError: Error {
    case noToken
    case invalidResponse
    case decodingError
}`
                }
              ]}
            />

            <h4 className="font-semibold">2. Secure Storage (Keychain)</h4>
            <CodeBlock
              examples={[
                {
                  language: "swift",
                  code: `// KeychainHelper.swift
import Foundation
import Security

class KeychainHelper {
    static let standard = KeychainHelper()
    
    func save(_ data: String, key: String) {
        let data = Data(data.utf8)
        
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ] as CFDictionary
        
        SecItemDelete(query)
        SecItemAdd(query, nil)
    }
    
    func read(key: String) -> String? {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ] as CFDictionary
        
        var result: AnyObject?
        SecItemCopyMatching(query, &result)
        
        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    func delete(key: String) {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ] as CFDictionary
        
        SecItemDelete(query)
    }
}`
                }
              ]}
            />

            <h4 className="font-semibold">3. SwiftUI View Example</h4>
            <CodeBlock
              examples={[
                {
                  language: "swift",
                  code: `// AccountsView.swift
import SwiftUI

struct AccountsView: View {
    @StateObject private var viewModel = AccountsViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading accounts...")
                } else if let error = viewModel.error {
                    Text("Error: \\(error.localizedDescription)")
                } else {
                    List(viewModel.accounts) { account in
                        AccountRow(account: account)
                    }
                }
            }
            .navigationTitle("Accounts")
            .task {
                await viewModel.loadAccounts()
            }
        }
    }
}

class AccountsViewModel: ObservableObject {
    @Published var accounts: [Account] = []
    @Published var isLoading = false
    @Published var error: Error?
    
    func loadAccounts() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await KOBAPIService.shared.getAccounts(
                consentId: "your_consent_id"
            )
            await MainActor.run {
                self.accounts = response.data.account
            }
        } catch {
            await MainActor.run {
                self.error = error
            }
        }
    }
}`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Android Integration */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Android Integration (Kotlin)</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Kotlin Implementation</CardTitle>
            <CardDescription>Native Android integration with Kotlin and Retrofit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-semibold">1. Add Dependencies (build.gradle)</h4>
            <CodeBlock
              examples={[
                {
                  language: "kotlin",
                  code: `dependencies {
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'androidx.security:security-crypto:1.1.0-alpha06'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}`
                }
              ]}
            />

            <h4 className="font-semibold">2. Create API Service</h4>
            <CodeBlock
              examples={[
                {
                  language: "kotlin",
                  code: `// KOBApiService.kt
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

interface KOBApiService {
    @GET("aisp-accounts")
    suspend fun getAccounts(
        @Header("Authorization") token: String,
        @Header("x-consent-id") consentId: String
    ): AccountsResponse
    
    @POST("pisp-domestic-payment")
    suspend fun initiatePayment(
        @Header("Authorization") token: String,
        @Body paymentData: PaymentRequest
    ): PaymentResponse
    
    companion object {
        private const val BASE_URL = "https://api.kangopenbanking.com/v1/"
        
        fun create(): KOBApiService {
            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(KOBApiService::class.java)
        }
    }
}

// KOBRepository.kt
class KOBRepository(
    private val api: KOBApiService,
    private val secureStorage: SecureStorage
) {
    suspend fun getAccounts(consentId: String): Result<AccountsResponse> {
        return try {
            val token = secureStorage.getToken() ?: return Result.failure(Exception("No token"))
            val response = api.getAccounts("Bearer $token", consentId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun initiatePayment(paymentData: PaymentRequest): Result<PaymentResponse> {
        return try {
            val token = secureStorage.getToken() ?: return Result.failure(Exception("No token"))
            val response = api.initiatePayment("Bearer $token", paymentData)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}`
                }
              ]}
            />

            <h4 className="font-semibold">3. Secure Storage</h4>
            <CodeBlock
              examples={[
                {
                  language: "kotlin",
                  code: `// SecureStorage.kt
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import android.content.Context

class SecureStorage(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "kob_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    fun saveToken(token: String) {
        sharedPreferences.edit().putString("access_token", token).apply()
    }
    
    fun getToken(): String? {
        return sharedPreferences.getString("access_token", null)
    }
    
    fun clearToken() {
        sharedPreferences.edit().remove("access_token").apply()
    }
}`
                }
              ]}
            />

            <h4 className="font-semibold">4. Jetpack Compose UI</h4>
            <CodeBlock
              examples={[
                {
                  language: "kotlin",
                  code: `// AccountsScreen.kt
@Composable
fun AccountsScreen(viewModel: AccountsViewModel = viewModel()) {
    val accounts by viewModel.accounts.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.loadAccounts()
    }
    
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Accounts") })
        }
    ) { padding ->
        when {
            isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            error != null -> {
                Text(
                    text = "Error: \${error?.message}",
                    modifier = Modifier.padding(16.dp)
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.padding(padding)
                ) {
                    items(accounts) { account ->
                        AccountItem(account)
                    }
                }
            }
        }
    }
}

// AccountsViewModel.kt
class AccountsViewModel(
    private val repository: KOBRepository
) : ViewModel() {
    private val _accounts = MutableStateFlow<List<Account>>(emptyList())
    val accounts: StateFlow<List<Account>> = _accounts.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<Exception?>(null)
    val error: StateFlow<Exception?> = _error.asStateFlow()
    
    fun loadAccounts() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getAccounts("your_consent_id")
                .onSuccess { response ->
                    _accounts.value = response.data.account
                }
                .onFailure { exception ->
                    _error.value = exception as? Exception
                }
            _isLoading.value = false
        }
    }
}`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* React Native */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">React Native Integration</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>React Native Implementation</CardTitle>
            <CardDescription>Cross-platform mobile apps with React Native</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-semibold">Install Dependencies</h4>
            <CodeBlock
              examples={[
                {
                  language: "bash",
                  code: `npm install axios @react-native-async-storage/async-storage
npm install react-native-keychain`
                }
              ]}
            />

            <h4 className="font-semibold">API Service</h4>
            <CodeBlock
              examples={[
                {
                  language: "typescript",
                  code: `// services/kobApi.ts
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const API_BASE = 'https://api.kangopenbanking.com/v1';

class KOBApiService {
  private async getToken(): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword();
    return credentials ? credentials.password : null;
  }

  async setToken(token: string) {
    await Keychain.setGenericPassword('kob_token', token);
  }

  async getAccounts(consentId: string) {
    const token = await this.getToken();
    if (!token) throw new Error('No token found');

    const response = await axios.get(\`\${API_BASE}/aisp-accounts\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'x-consent-id': consentId,
      },
    });

    return response.data;
  }

  async initiatePayment(paymentData: any) {
    const token = await this.getToken();
    if (!token) throw new Error('No token found');

    const response = await axios.post(
      \`\${API_BASE}/pisp-domestic-payment\`,
      paymentData,
      {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }
}

export default new KOBApiService();`
                }
              ]}
            />

            <h4 className="font-semibold">React Component</h4>
            <CodeBlock
              examples={[
                {
                  language: "typescript",
                  code: `// screens/AccountsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import kobApi from '../services/kobApi';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await kobApi.getAccounts('your_consent_id');
      setAccounts(data.Data.Account);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={accounts}
      keyExtractor={(item) => item.AccountId}
      renderItem={({ item }) => (
        <View style={styles.accountItem}>
          <Text style={styles.accountName}>{item.Nickname}</Text>
          <Text>{item.AccountType}</Text>
          <Text>{item.Currency}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  accountName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
});`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Flutter */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Flutter Integration</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Flutter Implementation</CardTitle>
            <CardDescription>Cross-platform mobile apps with Flutter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <h4 className="font-semibold">Add Dependencies (pubspec.yaml)</h4>
            <CodeBlock
              examples={[
                {
                  language: "yaml",
                  code: `dependencies:
  http: ^1.1.0
  flutter_secure_storage: ^9.0.0
  provider: ^6.1.1`
                }
              ]}
            />

            <h4 className="font-semibold">API Service</h4>
            <CodeBlock
              examples={[
                {
                  language: "dart",
                  code: `// lib/services/kob_api_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class KOBApiService {
  static const String baseUrl = 'https://api.kangopenbanking.com/v1';
  final storage = const FlutterSecureStorage();
  
  Future<String?> getToken() async {
    return await storage.read(key: 'kob_access_token');
  }
  
  Future<void> setToken(String token) async {
    await storage.write(key: 'kob_access_token', value: token);
  }
  
  Future<Map<String, dynamic>> getAccounts(String consentId) async {
    final token = await getToken();
    if (token == null) throw Exception('No token found');
    
    final response = await http.get(
      Uri.parse('$baseUrl/aisp-accounts'),
      headers: {
        'Authorization': 'Bearer $token',
        'x-consent-id': consentId,
      },
    );
    
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load accounts');
    }
  }
  
  Future<Map<String, dynamic>> initiatePayment(Map<String, dynamic> paymentData) async {
    final token = await getToken();
    if (token == null) throw Exception('No token found');
    
    final response = await http.post(
      Uri.parse('$baseUrl/pisp-domestic-payment'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode(paymentData),
    );
    
    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to initiate payment');
    }
  }
}`
                }
              ]}
            />

            <h4 className="font-semibold">Flutter Widget</h4>
            <CodeBlock
              examples={[
                {
                  language: "dart",
                  code: `// lib/screens/accounts_screen.dart
import 'package:flutter/material.dart';
import '../services/kob_api_service.dart';

class AccountsScreen extends StatefulWidget {
  @override
  _AccountsScreenState createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  final _apiService = KOBApiService();
  List<dynamic> _accounts = [];
  bool _loading = true;
  String? _error;
  
  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }
  
  Future<void> _loadAccounts() async {
    try {
      final data = await _apiService.getAccounts('your_consent_id');
      setState(() {
        _accounts = data['Data']['Account'];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Accounts')),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: \$_error'))
              : ListView.builder(
                  itemCount: _accounts.length,
                  itemBuilder: (context, index) {
                    final account = _accounts[index];
                    return ListTile(
                      title: Text(account['Nickname']),
                      subtitle: Text(account['AccountType']),
                      trailing: Text(account['Currency']),
                    );
                  },
                ),
    );
  }
}`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Mobile Security Best Practices</CardTitle>
          <CardDescription>Essential security guidelines for mobile integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Use Secure Storage</p>
              <p className="text-sm text-muted-foreground">Store tokens in Keychain (iOS), EncryptedSharedPreferences (Android), or secure storage libraries</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Implement Certificate Pinning</p>
              <p className="text-sm text-muted-foreground">Pin SSL certificates to prevent man-in-the-middle attacks</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Handle OAuth Redirects Properly</p>
              <p className="text-sm text-muted-foreground">Use Custom URL Schemes (iOS) or App Links (Android) for secure OAuth redirects</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Implement Biometric Authentication</p>
              <p className="text-sm text-muted-foreground">Add Face ID, Touch ID, or fingerprint authentication for sensitive operations</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Obfuscate Your Code</p>
              <p className="text-sm text-muted-foreground">Use ProGuard (Android) or code obfuscation tools to protect your app logic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}

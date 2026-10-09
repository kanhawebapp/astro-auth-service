import gql from "graphql-tag";

export default gql`
  # ================= ENUMS =================
  scalar Upload
  
  enum Gender {
    MALE
    FEMALE
    OTHER
  }

  enum ApprovalStatus {
    PENDING
    INTERVIEW
    DOCUMENT_VERIFICATION
    APPROVED
    REJECTED
  }

  # ================= COMMON =================

  type MessageResponse {
    message: String
    success: Boolean
  }

  # ================= TYPES =================

 type Astrologer {
  id: ID!
  profilePic: String!
  name: String!
  dateOfBirth: String!
  gender: Gender!
  languages: [String!]!
  skills: [String!]!
  experience: Int!
  email: String!
  contactNo: String!
  about: String!
  approvalStatus: ApprovalStatus!
  adminRemarks: String
  addresses: [Address!]!
  experiences: [ExperiencePlatform!]!
  createdAt: String
  updatedAt: String

  isChatActive: Boolean
  isCallActive: Boolean
  isLiveActive: Boolean
  isPromotional: Boolean
}

  type Address {
    street: String!
    city: String!
    state: String!
    country: String!
    pincode: String!
  }

  type ExperiencePlatform {
    platformName: String!
    yearsWorked: Int!
  }

  # ================= INPUTS =================

  input AddressInput {
    street: String!
    city: String!
    state: String!
    country: String!
    pincode: String!
  }

  input ExperiencePlatformInput {
    platformName: String!
    yearsWorked: Int!
  }

  input RegisterAstrologerInput {
    profilePic: String!
    name: String!
    dateOfBirth: String!
    gender: Gender!
    languages: [String!]!
    skills: [String!]!
    experience: Int!
    email: String!
    contactNo: String!
    about: String!
    addresses: [AddressInput!]!
    experiences: [ExperiencePlatformInput!]!
  }

  # ================= AUTH PAYLOADS =================

  type AstrologerAuthPayload {
    accessToken: String!
    refreshToken: String!
    astrologer: Astrologer!
  }

  type AstrologerRefreshAuthPayload {
    accessToken: String!
  }

  # ================= QUERY =================

  #---------------------start code for astrologer earnings--------
  type AstrologerEarningSummary {
    totalEarnings: Float!
    totalWithdrawn: Float!
    currentBalance: Float!
    totalSessions: Int!
    totalChatMinutes: Int!
  }

  type AstrologerEarningTransaction {
    id: ID!
    type: String!
    amount: Float
    coins: Int
    description: String
    createdAt: String
      sessionId: String
  }

  type AstrologerEarningResponse {
    summary: AstrologerEarningSummary!
    transactions: [AstrologerEarningTransaction!]!
  }

  #--------end code for astrologer earnings---------------------

  #-----------------------start code for astrologer chat history-----
  enum SessionStatus {
    REQUESTED
    ACCEPTED
    ONGOING
    COMPLETED
    CANCELLED
    FAILED
  }
  type AstrologerChatHistoryItem {
    sessionId: String
    roomId: String
userId: ID
    userName: String
    userMobile: String
    userCountryCode: String

    birthPlace: String
    birthDate: String
    birthTime: String
    occupation: String
    gender: Gender
    intakeName: String

    startedAt: String
    endedAt: String
    createdAt: String

    status: String

    durationSec: Int
    durationMinutes: Int

    ratePerMin: Int

    coinsEarned: Float
    commission: Float

    rating: Int
    reviewComment: String

    lastMessage: String
    source: String 
  }

  type AstrologerChatHistoryResponse {
    success: Boolean!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
    data: [AstrologerChatHistoryItem!]!
  }

  input AstrologerChatHistoryFilterInput {
    page: Int
    limit: Int

    userName: String
    status: SessionStatus
    source: String
    startDate: String
    endDate: String
  }

  #------end code for astrologer chat history-----------------------
  # ================= MESSAGE TYPES =================

  type ChatMessage {
    id: ID!

    msgId: String
    roomId: String

    senderId: String
    receiverId: String

    message: String
    image: String
    sender: String

    replyTo: String
    time: String

    createdAt: String
  }

  type GetSessionMessagesResponse {
    success: Boolean!
    totalCount: Int!

    data: [ChatMessage!]!
  }
  #------------------------END code for message----------------------

  #----------------start code for call history----------------------
  # ================= CALL HISTORY =================

  type AstrologerCallHistoryItem {
    sessionId: String
    roomId: String
userId: ID
    userName: String
    userMobile: String
    userCountryCode: String

    startedAt: String
    endedAt: String
    createdAt: String

    status: String

    durationSec: Int
    durationMinutes: Int

    ratePerMin: Int

    coinsEarned: Float
    commission: Float
    source: String 
    lastMessage: String
  }

  type AstrologerCallHistoryResponse {
    success: Boolean!
    totalCount: Int!
    currentPage: Int!
    totalPages: Int!
    
    data: [AstrologerCallHistoryItem!]!
  }

  input AstrologerCallHistoryFilterInput {
    page: Int
    limit: Int

    userName: String
    status: SessionStatus
    source: String
    startDate: String
    endDate: String
  }
  #---------END code for call history----------------------

  #---------start code for astrologer wallet transactions----------------------
  type WalletTransactionItem {
    id: String!

    type: String!

    amount: Float

    coins: Int

    description: String
sessionId: String
    createdAt: String!
  }

  type WalletTransactionResponse {
    success: Boolean!

    totalCount: Int!

    currentPage: Int!

    totalPages: Int!

    data: [WalletTransactionItem!]!
  }
  #-----END code for astrologer wallet transactions----------------------

  #--------------------start code for get astrologer reviews--------------
  # ================= REVIEW TYPES =================

  type ReviewItem {
    id: ID!

    sessionId: String
    sessionType: String
    sessionStatus: String

    durationSec: Int

    startedAt: String
    endedAt: String

    userName: String
    astroName: String

    rating: Int!
    comment: String
    reply: String

    isFlagged: Boolean

    createdAt: String!
  }

  type ReviewResponse {
    success: Boolean!

    totalCount: Int!

    currentPage: Int!

    totalPages: Int!

    limit: Int!

    data: [ReviewItem!]!
  }

  input ReviewFilterInput {
    page: Int
    limit: Int
    rating: Int
  }
  #-----------Start code for getAstrologerProfile----------------------
  enum DocumentStatus {
    PENDING
    VERIFIED
    REJECTED
  }

  enum PricingType {
  CHAT
  CALL
  VIDEO
  AUDIO
  GIFT_COMMISSION
  OFFER
}

  type AstrologerPricing {
    id: ID
    type: PricingType
    price: Float
    offerPrice: Float
    commissionPercent: Float
    isActive: Boolean
  }

  type AstrologerAddress {
    street: String
    city: String
    state: String
    country: String
    pincode: String
  }

  type AstrologerExperience {
    platformName: String
    yearsWorked: Int
  }

  type AstrologerReview {
    id: ID
    rating: Int
    comment: String
    reply: String
    userName: String
    createdAt: String
  }

  type AstrologerProfile {
    id: ID

    profilePic: String
    name: String
    displayName: String

    email: String
    contactNo: String

    gender: Gender
    about: String

    languages: [String]
    skills: [String]
    problems: [String]

    experience: Int
    rating: Float

    tags: String
    vtags: String

    status: Boolean

    createdAt: String

    pricing: [AstrologerPricing]

    wallet: AstrologerWalletInfo

    recentReviews: [AstrologerReview]

    addresses: [AstrologerAddress]

    experiences: [AstrologerExperience]

    totalReviews: Int
    totalSessions: Int

    kycDetail: KycDetailResponse
  }
  type AstrologerWalletInfo {
    balanceCoins: Float
    totalEarned: Int
    totalWithdrawn: Int
  }

  type AstrologerProfileResponse {
    success: Boolean!
    message: String!
    data: AstrologerProfile
  }

  type KycDetailResponse {
    accountHolderName: String
    accountNumber: String
    bankName: String
    ifsc: String
    branchName: String
    panNumber: String
    aadhaarImage: String
    panImage: String
    passbookImage: String

    status: DocumentStatus
  }
  #--------END--code for getAstrologerProfile----------------------

  #-----------------start code for getUser Details--------
  type UserWalletInfo {
    balanceCoins: Float
    lockedCoins: Float
  }

  type UserDetails {
    id: ID!
    name: String
    mobile: String
    countryCode: String
    gender: Gender

    birthDate: String
    birthTime: String

    occupation: String

    isActive: Boolean

    wallet: UserWalletInfo

    totalSessions: Int
    completedSessions: Int

    totalReviews: Int

    createdAt: String
    updatedAt: String
  }
  #--END code for getUser Details-------

  #-----------------start code for getAstrologerSessions----------------------
#-----------------start code for getAstrologerSessions----------------------

input AstrologerSessionFilterInput {
  page: Int
  limit: Int
  userName: String
  source: String
  startDate: String
  endDate: String
  sessionType: SessionType 
}

type AstrologerSessionItem {
  sessionId: String
  chatId: String
  sessionType: SessionType  
  status: SessionStatus     
  userId: String
  userName: String
  userMobile: String
  userCountryCode: String
  birthPlace: String
  birthDate: String
  birthTime: String
  occupation: String
  gender: String
  rating: Int
  reviewComment: String
  startedAt: String
  endedAt: String
  createdAt: String
  durationSec: Int
  durationMinutes: Int
  ratePerMin: Int
  coinsEarned: Float
  commission: Float
  source: String
}

type AstrologerSessionResponse {
  success: Boolean!
  totalCount: Int!
  currentPage: Int!
  totalPages: Int!
  data: [AstrologerSessionItem!]!
}

#--END code for getAstrologerSessions----------------------
  #--END code for getAstrologerSessions----------------------

  #-----------START code for get Offer--
  type Offer {
  id: ID!
  offerName: String!
  price: Float!
  description: String
  isActive: Boolean!     # admin status
  selected: Boolean!     # astrologer status
  createdAt: String!
  updatedAt: String!
}

  type OfferResponse {
    success: Boolean!
    message: String!
    data: [Offer!]!
  }
  #--------END code for get Offer-------
  #-----   START CODE FOR REMEDY---

  type Remedy {
    id: ID!
    title: String!
    description: String!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  input SessionRemedyFilterInput {
    page: Int
    limit: Int

    sessionId: String

    startDate: String
    endDate: String
  }
  type RemedyResponse {
    success: Boolean!
    message: String!
    data: [Remedy!]!
  }

  type SessionRemedy {
    id: ID!
    sessionId: String!
    sessionType: SessionType
    remedyText: String!
    createdAt: String!
  }

  type SessionRemedyResponse {
    success: Boolean!

    message: String!

    totalCount: Int!

    currentPage: Int!

    totalPages: Int!

    data: [SessionRemedy!]!
  }
  enum SessionType {
    CHAT
    CALL
  }
  #------END CODE FOR REMEDY----------
  #---------------start code for kundali generation----------------------
 type KundaliResponse {
  status: Boolean
  userId: String
  requestType: String
  requestSessionId: String
  userName: String
  data: String          # or remove the field temporarily
}

  #---------------END code for kundali generation----------------------
 #-----------------start code for astrologer followers count-----------
 type FollowCountResponse {
  totalFollowers: Int!
}

type FollowerUser {
  id: ID!
  name: String
  mobile: String
  countryCode: String
}

type AstrologerFollower {
  id: ID!
  userId: String!
  astrologerId: String!
  createdAt: String!
  user: FollowerUser
}

type AstrologerFollowersResponse {
  followers: [AstrologerFollower!]!
  total: Int!
  page: Int!
  limit: Int!
  totalPages: Int!
}
 #----END code for astrologer followers count-----
 #--------START Booked services----------
 
type Service {
  id: ID!
  name: String!
  price: Float!
}

type ServiceBookingListResponse {
  success: Boolean!
  total: Int!
  currentPage: Int!
  totalPages: Int!
  limit: Int!
  data: [ServiceBooking!]!
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
}

enum BookingStatus {
  PENDING
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

type ServiceBooking {
  id: ID!

  userId: String!
  serviceId: String!
  astrologerId: String

  name: String!

  dob: String!
  tob: String!
  pob: String!

  gender: String
  concern: String

  amount: Float!

  paymentStatus: PaymentStatus!
  bookingStatus: BookingStatus!

  createdAt: String!
  updatedAt: String!

  service: Service
}
 #--------End Booked services------------
 #-----------Start code for change service----
 enum AstrologerServiceType {
  CHAT
  CALL
  LIVE
  PROMOTIONAL
}



 type CommonResponse {
  success: Boolean!
  message: String!
}

type MonthlyAnalytics {
  month: String!
  earnings: Float!
  chats: Int!
  calls: Int!
}

type AstrologerAnalytics {
  totalEarnings: Float!
  totalFollowers: Int!
  totalChats: Int!
  totalCalls: Int!
  averageRating: Float!
  monthlyData: [MonthlyAnalytics!]!
}
 #----------End -----------
 #-------start code for notice-----
 type Notice {
  id: String!
  title: String!
  description: String!
  targetType: String!
  isPinned: Boolean!
  isActive: Boolean!
  startDate: String
  endDate: String
  createdAt: String!
  updatedAt: String!
}

 #---------End-----------

 #---------START CODE FOR LIVE STREAMING---------------
enum AgoraRole {
  HOST
  AUDIENCE
}

enum LiveStatus {
  SCHEDULED
  LIVE
  ENDED
}

type LiveAstrologer {
  id: String!
  name: String
  displayName: String
  profilePic: String
  rating: Float
}

type LiveStream {
  id: String!
  astrologerId: String!

  title: String!
  channelName: String!

  status: LiveStatus!

  scheduledAt: String
  endedAt: String

  createdAt: String!
  updatedAt: String!

  astrologer: LiveAstrologer
}

type JoinLiveResponse {
  appId: String!
  channelName: String!
  uid: Int!
  rtcToken: String!
  chatUserId: String!
  chatToken: String!
  chatRoomId: String!
  chatAppKey: String!
}
  
#----------END CODE FOR LIVE STREAMING--------------

#-----------start-current chat messages that are running chat-------------
type ChatMessagesResponse {
  success: Boolean!
  totalCount: Int!
  data: [ChatMessage!]!
}

type ChatMessage {
  id: ID!
  msgId: String
  roomId: String
  senderId: String
  receiverId: String
  message: String
  image: String
  sender: String
  replyTo: String
  createdAt: String
}
#-------END ------------------------------------------------
#----------start get remedy for chat-----------


type GetRemediesResponse {
  success: Boolean!
  message: String!
  data: [Remedy!]!
}

#----------End get remedy for chat-------------

#-----------START CODE FOR GET APP VERSION---

type AppVersionData {
  id: ID!
  appType: String!
  platform: String!
  latestVersion: String!
  minimumVersion: String!
  forceUpdate: Boolean!
  maintenanceMode: Boolean!
  maintenanceMessage: String
  playStoreUrl: String
  appStoreUrl: String
  releaseNotes: String
  createdAt: String!
  updatedAt: String!
}

type GetAstrologerAppVersionResponse {
  success: Boolean!
  message: String!
  data: AppVersionData
}
#----------END CODE FOR APP VERSION----

#---------------START UPLOAD FILE--------

type UploadFileResponse {
  success: Boolean!
  message: String!
  url: String!
  filename: String!
}
#--------------END UPLOAD FILE-----------

#---------START CODE FOR CURRENT ASTROLOGER-----
type CurrentAstrologer {
  id: ID!
  name: String
  contactNo: String
}
#---------END CODE FOR CURRENT ASTROLOGER-------

#-------------------ASTROLOGER PAYOUT SUMMARY------------
type AstrologerPayoutSummary {
  totalPayouts: Int!
  totalRevenue: Float!
  totalCommission: Float!
  totalEarning: Float!
  totalPgCharge: Float!
  totalPgTotal: Float!
  totalGrossAmount: Float!
  totalTdsAmount: Float!
  totalLastPaidAmount: Float!
  totalPayableAmount: Float!
  totalIGST: Float!
  totalCGST: Float!
  totalSGST: Float!
  averageCommissionPercent: Float!
  averagePgChargeRate: Float!
  averageGstRate: Float!
  averageTdsPercent: Float!
}
type AstrologerPayoutSummaryResponse {
  success: Boolean!
  message: String!
  astrologer: Astrologer
  summary: AstrologerPayoutSummary!
}
#--------------------END -----------

  type Query {
    meAstrologer: Astrologer
    getAstrologerEarnings: AstrologerEarningResponse!
    getAstrologerChatHistory(
      filter: AstrologerChatHistoryFilterInput
    ): AstrologerChatHistoryResponse!

    getSessionMessages(sessionId: String!): GetSessionMessagesResponse!

    getAstrologerCallHistory(
      filter: AstrologerCallHistoryFilterInput
    ): AstrologerCallHistoryResponse!

    getAstrologerWalletTransactions(
      page: Int
      limit: Int
    ): WalletTransactionResponse!

    getAstrologerReviews(filter: ReviewFilterInput): ReviewResponse!

    getAstrologerProfile: AstrologerProfileResponse!

    getUserDetails(userId: String!): UserDetails!

    getAstrologerSessions(
      filter: AstrologerSessionFilterInput
    ): AstrologerSessionResponse!

    getOffers: OfferResponse!

    getRemedies: RemedyResponse!

    getSessionRemedies(filter: SessionRemedyFilterInput): SessionRemedyResponse!

    getKundali(requestSessionId: String!): KundaliResponse
    getAstrologerFollowersCount(
  astrologerId: ID!
): FollowCountResponse!

getAstrologerFollowers(
    astrologerId: String!
    page: Int
    limit: Int
  ): AstrologerFollowersResponse!

   getAstrologerAssignedBookedServices(
    page: Int
    limit: Int
    bookingStatus: BookingStatus
    paymentStatus: PaymentStatus
  ): ServiceBookingListResponse!

  getAstrologerById(astrologerId: String!): Astrologer

  getAstrologerAnalytics(astrologerId: String!): AstrologerAnalytics!
   getAstrologerNotices: [Notice!]!

  getLiveStreams: [LiveStream!]!

  joinLive(
    channelName: String!
    role: String!
  ): JoinLiveResponse!

  getMyScheduledLives: [LiveStream!]!
  

  getCurrentChatMessages(roomId: String!): ChatMessagesResponse!
   
  getRemediesForChat: GetRemediesResponse!

  getAstrologerAppVersion(platform: String!): GetAstrologerAppVersionResponse!

  getCurrentAstrologer: CurrentAstrologer!
  getAstrologerPayoutSummary: AstrologerPayoutSummaryResponse!
  
  
  }

  type Mutation {
    registerAstrologer(data: RegisterAstrologerInput!): Astrologer!

    requestAstrologerOtp(contactNo: String!): MessageResponse!

    verifyAstrologerOtp(
      contactNo: String!
      otp: String!
    ): AstrologerAuthPayload!

    refreshAstrologerToken: AstrologerRefreshAuthPayload!

    logoutAstrologer: MessageResponse!

    replyToReview(reviewId: String!, reply: String!): MessageResponse!

    updateOfferStatus(offerId: String!, isActive: Boolean!): MessageResponse!

    sendRemedy(sessionId: String!, remedyText: String!): MessageResponse!

    toggleAstrologerService(
    astrologerId: String!
    serviceType: AstrologerServiceType!
    status: Boolean!
  ): CommonResponse!
  #---------START CODE FOR LIVE STREAMING---------------

  startLive(
    title: String!
  ): LiveStream!

  endLive(
    streamId: String!
  ): Boolean!

  scheduleLive(
    title: String!
    scheduledAt: String!
  ): LiveStream!
  #----------END CODE FOR LIVE STREAMING--------------

  uploadFile(file: Upload!): UploadFileResponse!
  }
`;
